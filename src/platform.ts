import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { Socket } from 'dgram';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { WizSceneController } from './platformAccessory';
import { bindSocket, createSocket, registerPeriodicDiscovery, sendDiscoveryBroadcast } from './util/network';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class WizSceneControllerPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public readonly socket: Socket;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.platform);

    this.socket = createSocket(this);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      bindSocket(this, () => {
        sendDiscoveryBroadcast(this);
        registerPeriodicDiscovery(this);

        // run the method to discover / register your devices as accessories
        this.discoverDevices();
      });
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {

    // Get Accessory Groups
    const accessoryGroups = this.config.accessoryGroups;
    this.log.debug('Accessory groups configured: ' + accessoryGroups.map(accessory => accessory.groupName));

    for (const accessoryGroup of accessoryGroups) {
      const uuid = this.api.hap.uuid.generate(accessoryGroup.groupName);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        new WizSceneController(this, existingAccessory);
      } else {
        this.log.info('Adding new accessory:', accessoryGroup.groupName);

        // create a new accessory
        const accessory = new this.api.platformAccessory(accessoryGroup.groupName, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.accessoryGroup = accessoryGroup;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        new WizSceneController(this, accessory);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
