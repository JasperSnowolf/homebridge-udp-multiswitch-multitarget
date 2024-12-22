import { PlatformConfig } from 'homebridge';

export interface Config extends PlatformConfig {
  port?: number;
  enableScenes?: boolean;
  lastStatus?: boolean;
  broadcast?: string;
  address?: string;
  devices?: { host?: string; mac?: string; name?: string }[];
  ignoredDevices?: { host?: string; mac?: string }[];
  refreshInterval?: number;
}
export interface Device {
  name: string;
  macAddress: string;
  ipAddress?: string;
  mappedIpAddress?: { ipAddress: string };
  lastSelectedSceneId?: number;
}

export interface LightSetting {
  state?: boolean;
  sceneId?: number;
  speed?: number;
  temp?: number;
  dimming?: number;
  r?: number;
  g?: number;
  b?: number;
}

export interface LightResponse {
  method: string;
  env: string;
}

export interface LightRegistrationResposne extends LightResponse {
  result: LightResult;
}

export interface LightResult {
  mac: string;
}
