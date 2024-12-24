export interface AccessoryGroup {
  groupName: string;
  accessories: Device[];
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
