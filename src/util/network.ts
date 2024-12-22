import dgram from 'dgram';
import getMac from 'getmac';
import internalIp from 'internal-ip';

import { Device, LightResponse, LightRegistrationResposne, LightSetting } from '../types';
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
      timeout: NodeJS.Timeout;
      callbacks: ((lightSetting?: LightSetting, hapStatus?: HAPStatus) => void)[];
    };
  };
} = {};

function getDeviceIpAddress(device: Device): string | undefined {
  return device.ipAddress ? device.ipAddress : deviceIpMap.get(device.macAddress);
}

export function getLightSetting(
  platform: WizSceneControllerPlatform, device: Device, onSuccess: (lightSetting?: LightSetting, hapStatus?: HAPStatus) => void): void {

  const deviceIpAddress = getDeviceIpAddress(device);

  if (!deviceIpAddress) {
    platform.log.error(`No device ip address found for device: ${JSON.stringify(device)}`);
    onSuccess(undefined, -70409);
    return;
  }

  platform.log.debug('Senging UDP request to: ' + deviceIpAddress);
  platform.socket.send(
    '{"method":"getPilot","params":{}}',
    BROADCAST_PORT,
    deviceIpAddress,
    (error: Error | null) => {
      if (error !== null && deviceIpAddress in requestQueue) {
        platform.log.debug(
          `[Socket] Failed to send getPilot response to ${
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
    platform.log.warn(`Request timeout to device name/mac/ip: ${device.name}/${device.macAddress}/${deviceIpAddress}`);
    const callbacks = requestQueue[deviceIpAddress]['getPilot']?.callbacks;
    if (callbacks) {
      callbacks.forEach(callback => callback(undefined, -70409));
    }
  }, 500);

  if (!requestQueue[deviceIpAddress]['getPilot']) {
    requestQueue[deviceIpAddress]['getPilot'] = { timeout, callbacks: []};
  } else {
    clearTimeout(requestQueue[deviceIpAddress]['getPilot'].timeout);
    requestQueue[deviceIpAddress]['getPilot'].timeout = timeout;
  }

  requestQueue[deviceIpAddress]['getPilot'].callbacks.push(onSuccess);
}

export function setLightSetting(
  platform: WizSceneControllerPlatform, deviceList: Device[], lightSetting: LightSetting): void {

  const message = '{"method":"setPilot","params":' + JSON.stringify(lightSetting) + '}';

  deviceList.forEach(device => {
    const deviceIpAddress = getDeviceIpAddress(device);

    if (!deviceIpAddress) {
      platform.log.error(`No device ip address found for device: ${JSON.stringify(device)}`);
      return;
    }

    platform.log.debug('Senging UDP request to: ' + deviceIpAddress + ' ' + message);
    platform.socket.send(
      message,
      BROADCAST_PORT,
      deviceIpAddress,
      (error: Error | null) => {
        if (error !== null && deviceIpAddress in requestQueue) {
          platform.log.debug(
            `[Socket] Failed to send getPilot response to ${
              deviceIpAddress
            }: ${error.toString()}`,
          );
        }
      },
    );
  });
}

const setPilotQueue: { [key: string]: ((error: Error | null) => void)[] } = {};
export function setPilot(
  platform: WizSceneControllerPlatform,
  device: Device,
  lightSetting: LightSetting,
  callback: (error: Error | null) => void,
) {

  const deviceIpAddress = getDeviceIpAddress(device);

  if (!deviceIpAddress) {
    const errorMessage = `No device ip address found for device: ${JSON.stringify(device)}`;
    platform.log.error(errorMessage);
    callback({ name: 'no_ip_error', message: errorMessage });
    return;
  }

  if (platform.config.lastStatus) {
    // Keep only the settings that cannot change the bulb color
    Object.keys(lightSetting).forEach((key: string) => {
      if (['sceneId', 'speed', 'temp', 'dimming', 'r', 'g', 'b'].includes(key)) {
        delete lightSetting[key as keyof typeof lightSetting];
      }
    });
  }
  const msg = JSON.stringify({
    method: 'setPilot',
    env: 'pro',
    params: Object.assign(
      {
        mac: deviceIpAddress,
        src: 'udp',
      },
      lightSetting,
    ),
  });
  if (deviceIpAddress in setPilotQueue) {
    setPilotQueue[deviceIpAddress].push(callback);
  } else {
    setPilotQueue[deviceIpAddress] = [callback];
  }
  platform.log.debug(`[SetPilot][${deviceIpAddress}:${BROADCAST_PORT}] ${msg}`);
  platform.socket.send(msg, BROADCAST_PORT, deviceIpAddress, (error: Error | null) => {
    if (error !== null && deviceIpAddress in setPilotQueue) {
      platform.log.debug(
        `[Socket] Failed to send setPilot response to ${
          deviceIpAddress
        }: ${error.toString()}`,
      );
      const callbacks = setPilotQueue[deviceIpAddress];
      delete setPilotQueue[deviceIpAddress];
      callbacks.map((f) => f(error));
    }
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
      const callbackbacksForMethod = methodsForDevice ? methodsForDevice[lightResponse.method]?.callbacks : null;
      clearTimeout(methodsForDevice?.[lightResponse.method]?.timeout);

      if (callbackbacksForMethod && callbackbacksForMethod.length > 0) {
        const lightSetting: LightSetting = JSON.parse(decryptedMsg).result;
        platform.log.debug('Received lighting setting for ' + rinfo.address + ' is: ' + JSON.stringify(lightSetting));
        platform.log.debug('Flushing all callbacks for:', rinfo.address, lightResponse.method);
        callbackbacksForMethod.forEach(callback => callback(lightSetting));
        delete methodsForDevice[lightResponse.method];
      }
    }
  });

  function handleRegistration(platform: WizSceneControllerPlatform, lightResponse: LightRegistrationResposne, ipAddress: string): void {
    const log = makeLogger(platform, 'Registration Handler');
    log.debug(`Registration response received for: ${lightResponse.result.mac}`);
    deviceIpMap.set(lightResponse.result.mac, ipAddress);
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

  // Send generic discovery message
  platform.socket.send(
    `{"method":"registration","params":{"phoneMac":"${MAC}","register":false,"phoneIp":"${ADDRESS}"}}`,
    BROADCAST_PORT,
    BROADCAST_ADDRESS,
  );

  // Send discovery message to listed devices
  if (Array.isArray(platform.config.devices)) {
    for (const device of platform.config.devices) {
      if (device.host) {
        log.info(`Sending discovery UDP broadcast to ${device.host}:${BROADCAST_PORT}`);
        platform.socket.send(
          `{"method":"registration","params":{"phoneMac":"${MAC}","register":false,"phoneIp":"${ADDRESS}"}}`,
          BROADCAST_PORT,
          device.host,
        );
      }
    }
  }
}