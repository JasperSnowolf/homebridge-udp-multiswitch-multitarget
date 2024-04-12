import { LightSetting } from './types';

interface HomekitScene {
  name: string;
  lightSetting: LightSetting;
}

export const SCENES: HomekitScene[] = [
  { name: 'No Scene', lightSetting: { sceneId: 0 }},
  { name: 'Ocean', lightSetting: { sceneId: 1 }},
  { name: 'Romance', lightSetting: { sceneId: 2 }},
  { name: 'Sunset', lightSetting: { sceneId: 3 }},
  { name: 'Party', lightSetting: { sceneId: 4 }},
  { name: 'Fireplace', lightSetting: { sceneId: 5 }},
  { name: 'Cozy', lightSetting: { sceneId: 6 }},
  { name: 'Forest', lightSetting: { sceneId: 7 }},
  { name: 'Pastel Colors', lightSetting: { sceneId: 8 }},
  { name: 'Wake up', lightSetting: { sceneId: 9 }},
  { name: 'Bedtime', lightSetting: { sceneId: 10 }},
  { name: 'Warm White', lightSetting: { sceneId: 11 }},
  { name: 'Daylight', lightSetting: { sceneId: 12 }},
  { name: 'Cool white', lightSetting: { sceneId: 13 }},
  { name: 'Night light', lightSetting: { sceneId: 14 }},
  { name: 'Focus', lightSetting: { sceneId: 15 }},
  { name: 'Relax', lightSetting: { sceneId: 16 }},
  { name: 'True colors', lightSetting: { sceneId: 17 }},
  { name: 'TV time', lightSetting: { sceneId: 18 }},
  { name: 'Plantgrowth', lightSetting: { sceneId: 19 }},
  { name: 'Spring', lightSetting: { sceneId: 20 }},
  { name: 'Summer', lightSetting: { sceneId: 21 }},
  { name: 'Fall', lightSetting: { sceneId: 22 }},
  { name: 'Deepdive', lightSetting: { sceneId: 23 }},
  { name: 'Jungle', lightSetting: { sceneId: 24 }},
  { name: 'Mojito', lightSetting: { sceneId: 25 }},
  { name: 'Club', lightSetting: { sceneId: 26 }},
  { name: 'Christmas', lightSetting: { sceneId: 27 }},
  { name: 'Halloween', lightSetting: { sceneId: 28 }},
  { name: 'Candlelight', lightSetting: { sceneId: 29 }},
  { name: 'Golden white', lightSetting: { sceneId: 30 }},
  { name: 'Pulse', lightSetting: { sceneId: 31 }},
  { name: 'Steampunk', lightSetting: { sceneId: 32 }},
  { name: 'White', lightSetting: { temp: 3000 }},
];
