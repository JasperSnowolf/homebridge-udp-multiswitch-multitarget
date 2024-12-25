import dgram from 'dgram';
import getMac from 'getmac';
import internalIp from 'internal-ip';

import { Device, LightResponse, LightRegistrationResposne, LightSetting, AccessoryGroup } from '../types';
import { WizSceneControllerPlatform } from '../platform';
import { makeLogger } from './logger';
import { HAPStatus } from 'homebridge';

function strMac() {
  return getMac().toUpperCase().replace(/:/g, '');
}

function strIp() {
  return internalIp.v4.sync() ?? '0.0.0.0';
}

const BROADCAST_ADDRESS = '255.255.255.255';
const BROADCAST_PORT = 38899;
const LISTEN_PORT = 38901;
const ADDRESS = strIp();
const MAC = strMac();

const deviceIpMap: Map<string, string> = new Map<string, string>();

const requestQueue: {
  [ipAddress: string]: {
    [method: string]: {
      accessoryGroupName: string;
      timeout: NodeJS.Timeout;
      callbacks: ((lightSetting?: LightSetting, hapStatus?: HAPStatus) => void)[];
    };
  };
} = {};

const accessoryRequestMap: Map<string, string[]> = new Map<string, string[]>();

const nonReachableDevices: string[] = [];

function getDeviceIpAddress(device: Device): string | undefined {
  return device.ipAddress ? device.ipAddress : deviceIpMap.get(device.macAddress);
}

export function getAccessoryGroupSetting(
  platform: WizSceneControllerPlatform,
  accessoryGroup: AccessoryGroup,
  callback: (lightSetting?: LightSetting, hapStatus?: HAPStatus) => void):
  void {
  const requestsSent: boolean[] = accessoryGroup.accessories
    .map(accessory => getLightSetting(accessoryGroup.groupName, platform, accessory, callback));

  if (!requestsSent.includes(true)) {
    callback(undefined, -70409);
  }
}

export function getLightSetting(
  accessoryGroupName: string,
  platform: WizSceneControllerPlatform,
  device: Device,
  callback: (lightSetting?: LightSetting, hapStatus?: HAPStatus) => void):
  boolean {
  const log = makeLogger(platform, 'Get Light Setting');
  const deviceIpAddress = getDeviceIpAddress(device);

  if (!deviceIpAddress) {
    if (!nonReachableDevices.includes(device.macAddress)) {
      log.error(`No device ip address found for device: ${JSON.stringify(device)}`);
      nonReachableDevices.push(device.macAddress);
    }
    return false;
  }

  log.debug('Senging UDP request to: ' + deviceIpAddress);
  platform.socket.send(
    '{"method":"getPilot","params":{}}',
    BROADCAST_PORT,
    deviceIpAddress,
    (error: Error | null) => {
      if (error !== null && deviceIpAddress in requestQueue) {
        log.debug(
          `Failed to send getPilot response to ${
            deviceIpAddress
          }: ${error.toString()}`,
        );
      }
    },
  );

  if (!requestQueue[deviceIpAddress]) {
    requestQueue[deviceIpAddress] = {};
  }

  const timeout = setTimeout(() => {
    log.warn(
      // eslint-disable-next-line max-len
      `Request timeout to Accessory Group name/device name/mac/ip: ${accessoryGroupName}/${device.name}/${device.macAddress}/${deviceIpAddress}`,
    );
    const callbacks = requestQueue[deviceIpAddress]['getPilot']?.callbacks;
    if (callbacks) {
      callbacks.forEach(callback => callback(undefined, -70409));
    }
  }, 2000);

  if (!requestQueue[deviceIpAddress]['getPilot']) {
    requestQueue[deviceIpAddress]['getPilot'] = { accessoryGroupName, timeout, callbacks: []};
  } else {
    clearTimeout(requestQueue[deviceIpAddress]['getPilot'].timeout);
    requestQueue[deviceIpAddress]['getPilot'].timeout = timeout;
  }

  requestQueue[deviceIpAddress]['getPilot'].callbacks.push(callback);

  if (accessoryRequestMap.has(accessoryGroupName)) {
    if (!accessoryRequestMap.get(accessoryGroupName)?.includes(deviceIpAddress)) {
      accessoryRequestMap.get(accessoryGroupName)?.push(deviceIpAddress);
    }
  } else {
    accessoryRequestMap.set(accessoryGroupName, [deviceIpAddress]);
  }
  return true;
}

export function setLightSetting(
  platform: WizSceneControllerPlatform, deviceList: Device[], lightSetting: LightSetting): void {
  const log = makeLogger(platform, 'Set Light Setting');

  const message = '{"method":"setPilot","params":' + JSON.stringify(lightSetting) + '}';

  deviceList.forEach(device => {
    const deviceIpAddress = getDeviceIpAddress(device);

    if (!deviceIpAddress) {
      if (!nonReachableDevices.includes(device.macAddress)) {
        log.error(`No device ip address found for device: ${JSON.stringify(device)}`);
        nonReachableDevices.push(device.macAddress);
      }
      return;
    }

    log.debug('Senging UDP request to: ' + deviceIpAddress + ' ' + message);
    platform.socket.send(
      message,
      BROADCAST_PORT,
      deviceIpAddress,
      (error: Error | null) => {
        if (error !== null && deviceIpAddress in requestQueue) {
          log.debug(
            `Failed to send getPilot response to ${
              deviceIpAddress
            }: ${error.toString()}`,
          );
        }
      },
    );
  });
}

export function createSocket(platform: WizSceneControllerPlatform) {
  const log = makeLogger(platform, 'Socket');

  const socket = dgram.createSocket('udp4');

  socket.on('error', (err) => {
    log.error(`UDP Error: ${err}`);
  });

  socket.on('message', (msg, rinfo) => {
    const decryptedMsg = msg.toString('utf8');
    log.debug(
      `[${rinfo.address}:${rinfo.port}] Received message: ${decryptedMsg}`,
    );

    const lightResponse: LightResponse = JSON.parse(decryptedMsg);

    if (lightResponse.method === 'registration') {
      handleRegistration(platform, lightResponse as LightRegistrationResposne, rinfo.address);
    } else if (lightResponse.method === 'getPilot') {
      const methodsForDevice = requestQueue[rinfo.address];

      if (!methodsForDevice) {
        return;
      }

      const methodContext = methodsForDevice[lightResponse.method];

      if (!methodContext) {
        return;
      }

      clearTimeout(methodContext.timeout);

      const accessoryGroupName = methodContext.accessoryGroupName;
      const lightSetting: LightSetting = JSON.parse(decryptedMsg).result;
      platform.log.debug(`Received lighting setting for: ${accessoryGroupName} ${rinfo.address} is: ${JSON.stringify(lightSetting)}`);
      platform.log.debug(`Calling all callbacks for: ${accessoryGroupName} ${rinfo.address} ${lightResponse.method}`);
      methodContext.callbacks.forEach(callback => callback(lightSetting));

      platform.log.debug(`Deleting all pending callbacks for Accessory Group: ${accessoryGroupName}`);
      accessoryRequestMap.get(accessoryGroupName)?.forEach(ipAddress => {
        platform.log.debug(`Deleting method context for: ${ipAddress} ${lightResponse.method}`);
        clearTimeout(requestQueue[ipAddress][lightResponse.method].timeout);
        delete requestQueue[ipAddress][lightResponse.method];
      });

      delete methodsForDevice[lightResponse.method];
    }
  });

  function handleRegistration(platform: WizSceneControllerPlatform, lightResponse: LightRegistrationResposne, ipAddress: string): void {
    const log = makeLogger(platform, 'Registration Handler');
    const macAddress = lightResponse.result.mac;

    log.debug(`Registration response received for: ${macAddress}`);
    if (nonReachableDevices.includes(macAddress)) {
      log.info(`Reconnected with device: ${macAddress}`);
      nonReachableDevices.splice(nonReachableDevices.indexOf(macAddress), 1);
    }

    if (deviceIpMap.has(macAddress) && deviceIpMap.get(macAddress) !== ipAddress) {
      log.info(`Updating IP Address for device ${macAddress}: ${deviceIpMap.get(macAddress)} -> ${ipAddress}`);
    }

    deviceIpMap.set(macAddress, ipAddress);
  }

  platform.api.on('shutdown', () => {
    log.debug('Shutting down socket');
    socket.close();
  });

  return socket;
}

export function bindSocket(platform: WizSceneControllerPlatform, onReady: () => void) {
  const log = makeLogger(platform, 'Socket');
  log.info(`Setting up socket on ${ADDRESS ?? '0.0.0.0'}:${LISTEN_PORT}`);
  platform.socket.bind(LISTEN_PORT, ADDRESS, () => {
    const sockAddress = platform.socket.address();
    log.debug(
      `Socket Bound: UDP ${sockAddress.family} listening on ${sockAddress.address}:${sockAddress.port}`,
    );
    platform.socket.setBroadcast(true);
    onReady();
  });
}

export function sendDiscoveryBroadcast(platform: WizSceneControllerPlatform) {
  const log = makeLogger(platform, 'Discovery');
  log.info(`Sending discovery UDP broadcast to ${BROADCAST_ADDRESS}:${BROADCAST_PORT}`);

  for (let i = 0; i < 3; i++) {
    platform.socket.send(
      `{"method":"registration","params":{"phoneMac":"${MAC}","register":false,"phoneIp":"${ADDRESS}"}}`,
      BROADCAST_PORT,
      BROADCAST_ADDRESS,
    );
  }
}

export function registerPeriodicDiscovery(platform: WizSceneControllerPlatform) {
  const log = makeLogger(platform, 'Periodic Discovery');
  setTimeout(() => {
    log.info('Starting Periodic Discovery');
    sendDiscoveryBroadcast(platform);
    registerPeriodicDiscovery(platform);
  }, 3600 * 1000);
}