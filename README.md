# Homebridge Wiz Scene Controller
This plugin allows configurable scene controllers to be created for controlling Wiz lights.

_________________________________________
#### Creating and maintaining Homebridge plugins consume a lot of time and effort, if you would like to share your appreciation, feel free to "Star" or donate. 

<a target="blank" href="https://www.paypal.me/conde171"><img src="https://img.shields.io/badge/Donate-PayPal-blue.svg"/></a>

_________________________________________


## Configuration Params

|             Parameter                   |                       Description                       | Required |
| --------------------------------------- | ------------------------------------------------------- |:--------:|
| `scenes`                                | What Scenes to expose for each Controller               |     ✓    |
| `accessoryGroups`                       | A Controller will be created for each Accessory Group   |     ✓    |
| `accessoryGroups.groupName`             | This will be the name of the Controller                 |     ✓    |
| `accessoryGroups.accessories`           | These are the Accessories to control with the Controller|     ✓    |
| `accessoryGroups.accessories.ipAddress` | The IP Address of the Accessory                         |     ✓    |
| `accessoryGroups.accessories.name`      | (Optional) A name to identify the Accessory             |          |

## Disclaimer
I mostly made this plugin to solve a problem I faced with my own Homekit/Homebridge/Wiz deployment. As such, I only have access to the
accessories that I have around my house. I cannot guarantee that this plugin will work with all Wiz accessories. The accessories I have all
support white temperatures, and RBG. 

My main motivation was to create a way to activate the Wiz Scenes from Homekit. An added bonus is that using the same UDP request machanism,
you can set any property of the lights that you want.

Feel free to reach out with any issues, and I'll see what I can do to help!