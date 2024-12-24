/* eslint-disable max-len */
import { Service, PlatformAccessory, CharacteristicValue, HAPStatus } from 'homebridge';

import { WizSceneControllerPlatform } from './platform';
import { getAccessoryGroupSetting, setLightSetting } from './util/network';
import { SCENES } from './scenes';
import { LightSetting } from './types';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class WizSceneController {
  private tvService: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private exampleStates = {
    On: false,
    Brightness: 100,
  };

  constructor(
    private readonly platform: WizSceneControllerPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'n/a')
      .setCharacteristic(this.platform.Characteristic.Model, 'n/a')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'n/a');

    this.tvService = this.accessory.getService(this.platform.Service.Television)
      || this.accessory.addService(this.platform.Service.Television);

    this.tvService.setCharacteristic(this.platform.Characteristic.ConfiguredName, accessory.context.accessoryGroup.groupName);

    // Is on/off
    this.tvService.getCharacteristic(this.platform.Characteristic.Active)
      .on('get', callback => getAccessoryGroupSetting(
        this.platform,
        this.accessory.context.accessoryGroup,
        (lightSetting?: LightSetting, hapStatus?: HAPStatus) => callback(hapStatus ? hapStatus : 0, Number(lightSetting?.state))))
      .onSet(this.setOn.bind(this));

    // What is the current Scene?
    this.tvService.getCharacteristic(this.platform.Characteristic.ActiveIdentifier)
      .on('get', callback => getAccessoryGroupSetting(
        this.platform,
        this.accessory.context.accessoryGroup,
        (lightSetting?: LightSetting, hapStatus?: HAPStatus) => callback(hapStatus ? hapStatus : 0, lightSetting?.sceneId)))
      .onSet(sceneId => setLightSetting(
        this.platform,
        this.accessory.context.accessoryGroup.accessories,
        SCENES[Number(sceneId)].lightSetting));

    // Brightness
    this.tvService.getCharacteristic(this.platform.Characteristic.Brightness)
      .on('get', callback => getAccessoryGroupSetting(
        this.platform,
        this.accessory.context.accessoryGroup,
        (lightSetting?: LightSetting, hapStatus?: HAPStatus) => callback(hapStatus ? hapStatus : 0, lightSetting?.dimming)))
      .onSet(brightness => setLightSetting(
        this.platform,
        this.accessory.context.accessoryGroup.accessories,
        { dimming: Number(brightness) }));

    // Initialize Scenes
    const configuredScenes: string[] = this.platform.config.scenes;
    this.platform.log.debug('Configured Scenes:', configuredScenes);

    // Remove unneeded Scenes
    const sceneIdList = SCENES.map((homekitScene, index) => index);
    this.accessory.services
      .filter(service => sceneIdList.includes(Number(service.subtype)))
      .filter(service => {
        const value = service.getCharacteristic(this.platform.Characteristic.Identifier).value?.toString() as string;
        this.platform.log.debug('Existing Serivce:', value, configuredScenes.includes(value));
        return !configuredScenes.includes(value);
      })
      .forEach(service => {
        this.platform.log
          .debug('Removing Service', service);
        // this.accessory.removeService(service);
      });

    // Setup new Scenes
    configuredScenes.forEach((sceneIndex) => {
      const sceneName = SCENES[sceneIndex].name;
      this.platform.log.debug('Adding scene:', sceneIndex, sceneName);

      const existingService = this.accessory.getService(sceneIndex);

      // Only create new Scenes if they don't already exist
      if (!existingService) {
        const service = this.accessory.addService(this.platform.Service.InputSource, String(sceneIndex), sceneName);
        service
          .setCharacteristic(this.platform.Characteristic.Identifier, sceneIndex)
          .setCharacteristic(this.platform.Characteristic.ConfiguredName, sceneName)
          .setCharacteristic(
            this.platform.Characteristic.IsConfigured,
            this.platform.Characteristic.IsConfigured.CONFIGURED,
          )
          .setCharacteristic(
            this.platform.Characteristic.InputSourceType,
            this.platform.Characteristic.InputSourceType.HDMI,
          );
        this.tvService!.addLinkedService(service);
      }
    });
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    setLightSetting(this.platform, this.accessory.context.accessoryGroup.accessories, {state: Boolean(value)});

    this.platform.log.debug('Set Characteristic On ->', value);
  }

}
