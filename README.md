# homebridge-http-homebridge
Simple HTTP switches for Homebridge - stateful and radio-button/multi-switch switches

*Forked from homebridge-switcheroo

## Switch Services

### Switch (standard on/off)
Meant to be used as a standard on/off switch. Light, projector, fan, etc.

```
{
        "accessory": "HttpMultiswitch",
        "switch_type": "Switch",
        "name": "My Projector",
        "http_method": "GET",
        "base_url": "http://192.168.0.XXX/command",
        "on_url": "/state/on",
        "off_url": "/state/off"
}
```

### Multiswitch (radio buttons)
Meant to be used as a switcher, where only one input is ever on.
Automaticaly turns off the other switches when turning on one ofe them.

Multiswitch appends the the string defined under 'multiurls' below to complete the path of the Url (Must be use in the same order of the devices in "multiswitch".
For example, when `PC Mode` is selected, the url generated will be `http://192.168.0.XXX/command?id=42786sdf787`. 
```
{
    "accessory": "HttpMultiswitch",
    "switch_type": "Multiswitch",
    "name": "My Multiswitch",
    "http_method": "GET",
    "base_url": "http://192.168.0.XXX/command?id=",
    "multiswitch": [
                "Apple TV Mode",
                "PC Mode",
                "Android Mode",
                "The Music Mode"
            ],
            "multiurls": [
                "43",
                "42786sdf787",
                "l1479461871215",
                "44"
            ]
}
```

## Configuration Params

|             Parameter            |                       Description                       | Required |
| -------------------------------- | ------------------------------------------------------- |:--------:|
| `name`                           | name of the accessory                                   |          |
| `switch_type`                    | `Switch` or `Multiswitch`                               |     ✓    |
| `base_url`                       | url endpoint for whatever is receiving these requests   |     ✓    |
| `http_method`                    | `GET` (default), `POST`,  `PUT`, `DELETE`               |          |
| `username`                       | username for request                                    |          |
| `password`                       | password for request                                    |          |
| `send_immediately`               | option for request                                      |          |
| `on_url` (only Switch)           | endpoint for the on state                               |     ✓    |
| `off_url` (only Switch)          | endpoint for the off state                              |     ✓    |
| `on_body` (only Switch)          | body for on state request                               |          |
| `off_body` (only Switch)         | body for off state request                              |          |
| `multiswitch` (only Multiswitch) | list of inputs for the Multiswitch - order is respected |     ✓    |
| `multiurls` (only Multiswitch)   | list of endpoint urls for multiswitch-order is respected|     ✓    |

## Help

  - Make sure specify a port in the if necessary. (i.e. `"base_url" : "http://192.168.0.XXX:2000"`)
  - Verify the correct `http_method` is begin used. Switcheroo defaults to `GET`

## Installation
Read about an example Raspberry Pi + Homebridge setup guide with this package [here](https://github.com/chriszelazo/Apartment-Homebridge-Setup).

1. Install homebridge using: `npm install -g homebridge`
2. Install homebridge-http using: `npm install -g homebridge-http-multiswitch`
3. Update your config file
