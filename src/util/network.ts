import dgram from 'dgram';
import getMac from 'getmac';
import internalIp from 'internal-ip';

import { Device, LightResponse, LightSetting } from '../types';
import { WizSceneControllerPlatform } from '../platform';
import { makeLogger } from './logger';

function strMac() {
  return getMac().toUpperCase().replace(/:/g, '');
}

function strIp() {
  return internalIp.v4.sync() ?? '0.0.0.0';
}

const BROADCAST_PORT = 38899;
const ADDRESS = strIp();
const MAC = strMac();

function getNetworkConfig() {
  return {
    ADDRESS: ADDRESS,
    PORT: 38901,
    MAC: MAC,
  };
}

const requestQueue: { [ipAddress: string]: { [method: string]: ((lightSetting: LightSetting) => void)[] } } = {};

const getPilotQueue: {
  [key: string]: ((error: Error | null, pilot: any) => void)[];
} = {};

export function getLightSetting(
  platform: WizSceneControllerPlatform, device: Device, onSuccess: (lightSetting: LightSetting) => void): void {

  platform.log.debug('Senging UDP request to: ' + device.ipAddress);
  platform.socket.send(
    '{"method":"getPilot","params":{}}',
    BROADCAST_PORT,
    device.ipAddress,
    (error: Error | null) => {
      if (error !== null && device.ipAddress in getPilotQueue) {
        platform.log.debug(
          `[Socket] Failed to send getPilot response to ${
            device.ipAddress
          }: ${error.toString()}`,
        );
      }
    },
  );

  if (!requestQueue[device.ipAddress]) {
    requestQueue[device.ipAddress] = {};
  }

  if (!requestQueue[device.ipAddress]['getPilot']) {
    requestQueue[device.ipAddress]['getPilot'] = [];
  }

  requestQueue[device.ipAddress]['getPilot'].push(onSuccess);
}

export function setLightSetting(
  platform: WizSceneControllerPlatform, deviceList: Device[], lightSetting: LightSetting): void {

  const message = '{"method":"setPilot","params":' + JSON.stringify(lightSetting) + '}';

  deviceList.forEach(device => {
    platform.log.debug('Senging UDP request to: ' + device.ipAddress + ' ' + message);
    platform.socket.send(
      message,
      BROADCAST_PORT,
      device.ipAddress,
      (error: Error | null) => {
        if (error !== null && device.ipAddress in getPilotQueue) {
          platform.log.debug(
            `[Socket] Failed to send getPilot response to ${
              device.ipAddress
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
        mac: device.ipAddress,
        src: 'udp',
      },
      lightSetting,
    ),
  });
  if (device.ipAddress in setPilotQueue) {
    setPilotQueue[device.ipAddress].push(callback);
  } else {
    setPilotQueue[device.ipAddress] = [callback];
  }
  platform.log.debug(`[SetPilot][${device.ipAddress}:${BROADCAST_PORT}] ${msg}`);
  platform.socket.send(msg, BROADCAST_PORT, device.ipAddress, (error: Error | null) => {
    if (error !== null && device.ipAddress in setPilotQueue) {
      platform.log.debug(
        `[Socket] Failed to send setPilot response to ${
          device.ipAddress
        }: ${error.toString()}`,
      );
      const callbacks = setPilotQueue[device.ipAddress];
      delete setPilotQueue[device.ipAddress];
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
    const callbacksForDevice = requestQueue[rinfo.address];
    const callbackbacksForMethod = callbacksForDevice ? callbacksForDevice[lightResponse.method] : null;

    if (callbackbacksForMethod && callbackbacksForMethod.length > 0) {
      const lightSetting: LightSetting = JSON.parse(decryptedMsg).result;
      platform.log.debug('Received lighting setting for ' + rinfo.address + ' is: ' + JSON.stringify(lightSetting));
      platform.log.debug('Flushing all callbacks for:', rinfo.address, lightResponse.method);
      callbackbacksForMethod.forEach(callback => callback(lightSetting));
      delete callbacksForDevice[lightResponse.method];
    }
  });

  platform.api.on('shutdown', () => {
    log.debug('Shutting down socket');
    socket.close();
  });

  return socket;
}

export function bindSocket(platform: WizSceneControllerPlatform) {
  const log = makeLogger(platform, 'Socket');
  const { PORT, ADDRESS } = getNetworkConfig();
  log.info(`Setting up socket on ${ADDRESS ?? '0.0.0.0'}:${PORT}`);
  platform.socket.bind(PORT, ADDRESS, () => {
    const sockAddress = platform.socket.address();
    log.debug(
      `Socket Bound: UDP ${sockAddress.family} listening on ${sockAddress.address}:${sockAddress.port}`,
    );
    platform.socket.setBroadcast(true);
  });
}
