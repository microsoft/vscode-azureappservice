/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Last updated on 2021-05-24
export const backupStacks: string = `{
    "value": [
        {
            "id": null,
            "name": "dotnet",
            "type": "Microsoft.Web/webAppStacks?stackOsType=All",
            "properties": {
                "displayText": ".NET",
                "value": "dotnet",
                "preferredOs": "windows",
                "majorVersions": [
                    {
                        "displayText": ".NET 5",
                        "value": "dotnet5",
                        "minorVersions": [
                            {
                                "displayText": ".NET 5",
                                "value": "5",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "v5.0",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "5.0.x"
                                        }
                                    },
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "DOTNETCORE|5.0",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "5.0.x"
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    {
                        "displayText": ".NET Core 3",
                        "value": "dotnetcore3",
                        "minorVersions": [
                            {
                                "displayText": ".NET Core 3.1 (LTS)",
                                "value": "3.1",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "3.1",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "3.1.301"
                                        }
                                    },
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "DOTNETCORE|3.1",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "3.1.301"
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    {
                        "displayText": ".NET Core 2",
                        "value": "dotnetcore2",
                        "minorVersions": [
                            {
                                "displayText": ".NET Core 2.1 (LTS)",
                                "value": "2.1",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "2.1",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "2.1.807"
                                        },
                                        "endOfLifeDate": "Mon Sep 21 20201 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "DOTNETCORE|2.1",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "2.1.807"
                                        },
                                        "endOfLifeDate": "Mon Sep 21 20201 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            }
                        ]
                    },
                    {
                        "displayText": "ASP.NET V4",
                        "value": "aspdotnetv4",
                        "minorVersions": [
                            {
                                "displayText": "ASP.NET V4.8",
                                "value": "v4.8",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "v4.0",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "3.1"
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    {
                        "displayText": "ASP.NET V3",
                        "value": "aspdotnetv3",
                        "minorVersions": [
                            {
                                "displayText": "ASP.NET V3.5",
                                "value": "v3.5",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "v2.0",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "2.1"
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        },
        {
            "id": null,
            "name": "node",
            "type": "Microsoft.Web/webAppStacks?stackOsType=All",
            "properties": {
                "displayText": "Node",
                "value": "node",
                "preferredOs": "linux",
                "majorVersions": [
                    {
                        "displayText": "Node 14",
                        "value": "14",
                        "minorVersions": [
                            {
                                "displayText": "Node 14 LTS",
                                "value": "14-lts",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "NODE|14-lts",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "14.x"
                                        },
                                        "endOfLifeDate": "Tue May 30 2023 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "~14",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "14.x"
                                        },
                                        "endOfLifeDate": "Tue May 30 2023 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            }
                        ]
                    },
                    {
                        "displayText": "Node 12",
                        "value": "12",
                        "minorVersions": [
                            {
                                "displayText": "Node 12 LTS",
                                "value": "12-lts",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "NODE|12-lts",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "12.x"
                                        },
                                        "endOfLifeDate": "Sun May 01 2022 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "12.13.0",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true
                                        },
                                        "endOfLifeDate": "Sun May 01 2022 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            }
                        ]
                    },
                    {
                        "displayText": "Node 10",
                        "value": "10",
                        "minorVersions": [
                            {
                                "displayText": "Node 10 LTS",
                                "value": "10-LTS",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "NODE|10-lts",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "10.x"
                                        },
                                        "endOfLifeDate": "Sat May 01 2021 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Node 10.14",
                                "value": "10.14",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "NODE|10.14",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "10.x"
                                        },
                                        "endOfLifeDate": "Sat May 01 2021 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "10.14.1",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "10.x"
                                        },
                                        "endOfLifeDate": "Sat May 01 2021 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Node 10.10",
                                "value": "10.10",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "10.0.0",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "10.x"
                                        },
                                        "endOfLifeDate": "Sat May 01 2021 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Node 10.6",
                                "value": "10.6",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "NODE|10.6",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "10.x"
                                        },
                                        "endOfLifeDate": "Sat May 01 2021 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "10.6.0",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true
                                        },
                                        "endOfLifeDate": "Sat May 01 2021 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Node 10.1",
                                "value": "10.1",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "NODE|10.1",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "10.x"
                                        },
                                        "endOfLifeDate": "Sat May 01 2021 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        },
        {
            "id": null,
            "name": "python",
            "type": "Microsoft.Web/webAppStacks?stackOsType=All",
            "properties": {
                "displayText": "Python",
                "value": "python",
                "preferredOs": "linux",
                "majorVersions": [
                    {
                        "displayText": "Python 3",
                        "value": "3",
                        "minorVersions": [
                            {
                                "displayText": "Python 3.8",
                                "value": "3.8",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "PYTHON|3.8",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "3.8"
                                        }
                                    }
                                }
                            },
                            {
                                "displayText": "Python 3.7",
                                "value": "3.7",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "PYTHON|3.7",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "3.7"
                                        }
                                    }
                                }
                            },
                            {
                                "displayText": "Python 3.6",
                                "value": "3.6",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "PYTHON|3.6",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "3.6"
                                        }
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "3.4.0",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "3.6"
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        },
        {
            "id": null,
            "name": "php",
            "type": "Microsoft.Web/webAppStacks?stackOsType=All",
            "properties": {
                "displayText": "PHP",
                "value": "php",
                "preferredOs": "linux",
                "majorVersions": [
                    {
                        "displayText": "PHP 7",
                        "value": "7",
                        "minorVersions": [
                            {
                                "displayText": "PHP 7.4",
                                "value": "7.4",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "7.4",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": false
                                        },
                                        "endOfLifeDate": "Wed Dec 28 2022 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "PHP|7.4",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": false
                                        },
                                        "endOfLifeDate": "Wed Dec 28 2022 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "PHP 7.3",
                                "value": "7.3",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "PHP|7.3",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": false
                                        },
                                        "endOfLifeDate": "Thu Jan 06 2022 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "7.3",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": false
                                        },
                                        "endOfLifeDate": "Thu Jan 06 2022 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        },
        {
            "id": null,
            "name": "ruby",
            "type": "Microsoft.Web/webAppStacks?stackOsType=All",
            "properties": {
                "displayText": "Ruby",
                "value": "ruby",
                "preferredOs": "linux",
                "majorVersions": [
                    {
                        "displayText": "Ruby 2",
                        "value": "2",
                        "minorVersions": [
                            {
                                "displayText": "Ruby 2.6",
                                "value": "2.6",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "RUBY|2.6",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": false
                                        }
                                    }
                                }
                            },
                            {
                                "displayText": "Ruby 2.6.2",
                                "value": "2.6.2",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "RUBY|2.6.2",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": false
                                        }
                                    }
                                }
                            },
                            {
                                "displayText": "Ruby 2.5",
                                "value": "2.5",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "RUBY|2.5",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": false
                                        }
                                    }
                                }
                            },
                            {
                                "displayText": "Ruby 2.5.5",
                                "value": "2.5.5",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "RUBY|2.5.5",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": false
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": false
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        },
        {
            "id": null,
            "name": "java",
            "type": "Microsoft.Web/webAppStacks?stackOsType=All",
            "properties": {
                "displayText": "Java",
                "value": "java",
                "preferredOs": "linux",
                "majorVersions": [
                    {
                        "displayText": "Java 11",
                        "value": "11",
                        "minorVersions": [
                            {
                                "displayText": "Java 11",
                                "value": "11.0",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "",
                                        "isAutoUpdate": true,
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "11"
                                        },
                                        "endOfLifeDate": "Thu Oct 01 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "11",
                                        "isAutoUpdate": true,
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "11"
                                        },
                                        "endOfLifeDate": "Thu Oct 01 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 11.0.9",
                                "value": "11.0.9",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "11"
                                        },
                                        "endOfLifeDate": "Thu Oct 01 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 11.0.8",
                                "value": "11.0.8",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "11.0.8",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "11"
                                        },
                                        "endOfLifeDate": "Thu Oct 01 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 11.0.7",
                                "value": "11.0.7",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "11"
                                        },
                                        "endOfLifeDate": "Thu Oct 01 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "11.0.7",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "11"
                                        },
                                        "endOfLifeDate": "Thu Oct 01 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 11.0.6",
                                "value": "11.0.6",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "11"
                                        },
                                        "endOfLifeDate": "Thu Oct 01 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "11.0.6",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "11"
                                        },
                                        "endOfLifeDate": "Thu Oct 01 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 11.0.5",
                                "value": "11.0.5",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "11"
                                        },
                                        "endOfLifeDate": "Thu Oct 01 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "11.0.5_ZULU",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "11"
                                        },
                                        "endOfLifeDate": "Thu Oct 01 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 11.0.3",
                                "value": "11.0.3",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "11.0.3_ZULU",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "11"
                                        },
                                        "endOfLifeDate": "Thu Oct 01 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 11.0.2",
                                "value": "11.0.2",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "11.0.2_ZULU",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "11"
                                        },
                                        "endOfLifeDate": "Thu Oct 01 2026 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            }
                        ]
                    },
                    {
                        "displayText": "Java 8",
                        "value": "8",
                        "minorVersions": [
                            {
                                "displayText": "Java 8",
                                "value": "8.0",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "",
                                        "isAutoUpdate": true,
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "8"
                                        },
                                        "endOfLifeDate": "Tue Apr 01 2025 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "1.8",
                                        "isAutoUpdate": true,
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "8"
                                        },
                                        "endOfLifeDate": "Tue Apr 01 2025 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 1.8.0_265",
                                "value": "8.0.265",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "1.8.0_265",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "8"
                                        },
                                        "endOfLifeDate": "Tue Apr 01 2025 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 1.8.0_252",
                                "value": "8.0.252",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "8"
                                        },
                                        "endOfLifeDate": "Tue Apr 01 2025 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "1.8.0_252",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "8"
                                        },
                                        "endOfLifeDate": "Tue Apr 01 2025 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 1.8.0_242",
                                "value": "8.0.242",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "8"
                                        },
                                        "endOfLifeDate": "Tue Apr 01 2025 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "1.8.0_242",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "8"
                                        },
                                        "endOfLifeDate": "Tue Apr 01 2025 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 1.8.0_232",
                                "value": "8.0.232",
                                "stackSettings": {
                                    "linuxRuntimeSettings": {
                                        "runtimeVersion": "",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "8"
                                        },
                                        "endOfLifeDate": "Tue Apr 01 2025 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    },
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "1.8.0_232_ZULU",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "8"
                                        },
                                        "endOfLifeDate": "Tue Apr 01 2025 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 1.8.0_212",
                                "value": "8.0.212",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "1.8.0_212_ZULU",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "8"
                                        },
                                        "endOfLifeDate": "Tue Apr 01 2025 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 1.8.0_202",
                                "value": "8.0.202",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "1.8.0_202_ZULU",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "8"
                                        },
                                        "endOfLifeDate": "Tue Apr 01 2025 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 1.8.0_181",
                                "value": "8.0.181",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "1.8.0_181_ZULU",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "8"
                                        },
                                        "endOfLifeDate": "Tue Apr 01 2025 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 1.8.0_172",
                                "value": "8.0.172",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "1.8.0_172_ZULU",
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": true,
                                            "supportedVersion": "8"
                                        },
                                        "endOfLifeDate": "Tue Apr 01 2025 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            }
                        ]
                    },
                    {
                        "displayText": "Java 7",
                        "value": "7",
                        "minorVersions": [
                            {
                                "displayText": "Java 7",
                                "value": "7.0",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "1.7",
                                        "isAutoUpdate": true,
                                        "isDeprecated": false,
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": false
                                        },
                                        "endOfLifeDate": "Tue Aug 01 2023 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 1.7.0_272",
                                "value": "7.0.272",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "1.7.0_272_ZULU",
                                        "isDeprecated": false,
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": false
                                        },
                                        "endOfLifeDate": "Tue Aug 01 2023 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            },
                            {
                                "displayText": "Java 1.7.0_262",
                                "value": "7.0.262",
                                "stackSettings": {
                                    "windowsRuntimeSettings": {
                                        "runtimeVersion": "1.7.0_262_ZULU",
                                        "isDeprecated": false,
                                        "remoteDebuggingSupported": false,
                                        "appInsightsSettings": {
                                            "isSupported": true,
                                            "isDefaultOff": true
                                        },
                                        "gitHubActionSettings": {
                                            "isSupported": false
                                        },
                                        "endOfLifeDate": "Tue Aug 01 2023 00:00:00 GMT+0000 (Greenwich Mean Time)"
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        },
        {
            "id": null,
            "name": "javacontainers",
            "type": "Microsoft.Web/webAppStacks?stackOsType=All",
            "properties": {
                "displayText": "Java Containers",
                "value": "javacontainers",
                "majorVersions": [
                    {
                        "displayText": "Java SE (Embedded Web Server)",
                        "value": "javase",
                        "minorVersions": [
                            {
                                "displayText": "Java SE (Embedded Web Server)",
                                "value": "SE",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "JAVA",
                                        "javaContainerVersion": "SE",
                                        "isAutoUpdate": true
                                    },
                                    "linuxContainerSettings": {
                                        "java11Runtime": "JAVA|11-java11",
                                        "java8Runtime": "JAVA|8-jre8",
                                        "isAutoUpdate": true
                                    }
                                }
                            },
                            {
                                "displayText": "Java SE 11.0.9",
                                "value": "11.0.9",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java11Runtime": "JAVA|11.0.9"
                                    }
                                }
                            },
                            {
                                "displayText": "Java SE 11.0.7",
                                "value": "11.0.7",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java11Runtime": "JAVA|11.0.7"
                                    }
                                }
                            },
                            {
                                "displayText": "Java SE 11.0.6",
                                "value": "11.0.6",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java11Runtime": "JAVA|11.0.6"
                                    }
                                }
                            },
                            {
                                "displayText": "Java SE 11.0.5",
                                "value": "11.0.5",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java11Runtime": "JAVA|11.0.5"
                                    }
                                }
                            },
                            {
                                "displayText": "Java SE 8u252",
                                "value": "1.8.252",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java8Runtime": "JAVA|8u252"
                                    }
                                }
                            },
                            {
                                "displayText": "Java SE 8u242",
                                "value": "1.8.242",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java8Runtime": "JAVA|8u242"
                                    }
                                }
                            },
                            {
                                "displayText": "Java SE 8u232",
                                "value": "1.8.232",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java8Runtime": "JAVA|8u232"
                                    }
                                }
                            }
                        ]
                    },
                    {
                        "displayText": "JBoss EAP",
                        "value": "jbosseap",
                        "minorVersions": [
                            {
                                "displayText": "JBoss EAP 7",
                                "value": "7",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java8Runtime": "JBOSSEAP|7-java8",
                                        "java11Runtime": "JBOSSEAP|7-java11",
                                        "isAutoUpdate": true,
                                        "isPreview": true
                                    }
                                }
                            },
                            {
                                "displayText": "JBoss EAP 7.3",
                                "value": "7.3.0",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java8Runtime": "JBOSSEAP|7.3-java8",
                                        "java11Runtime": "JBOSSEAP|7.3-java11",
                                        "isPreview": true
                                    }
                                }
                            }
                        ]
                    },
                    {
                        "displayText": "Tomcat 9.0",
                        "value": "tomcat9.0",
                        "minorVersions": [
                            {
                                "displayText": "Tomcat 9.0",
                                "value": "9.0",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "9.0",
                                        "isAutoUpdate": true
                                    },
                                    "linuxContainerSettings": {
                                        "java11Runtime": "TOMCAT|9.0-java11",
                                        "java8Runtime": "TOMCAT|9.0-jre8",
                                        "isAutoUpdate": true
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 9.0.41",
                                "value": "9.0.41",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java8Runtime": "TOMCAT|9.0.41-java8",
                                        "java11Runtime": "TOMCAT|9.0.41-java11"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 9.0.38",
                                "value": "9.0.38",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "9.0.38"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 9.0.37",
                                "value": "9.0.37",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "9.0.37"
                                    },
                                    "linuxContainerSettings": {
                                        "java11Runtime": "TOMCAT|9.0.37-java11",
                                        "java8Runtime": "TOMCAT|9.0.37-java8"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 9.0.33",
                                "value": "9.0.33",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java11Runtime": "TOMCAT|9.0.33-java11",
                                        "java8Runtime": "TOMCAT|9.0.33-java8"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 9.0.31",
                                "value": "9.0.31",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "9.0.31"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 9.0.27",
                                "value": "9.0.27",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "9.0.27"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 9.0.21",
                                "value": "9.0.21",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "9.0.21"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 9.0.20",
                                "value": "9.0.20",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java11Runtime": "TOMCAT|9.0.20-java11",
                                        "java8Runtime": "TOMCAT|9.0.20-java8"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 9.0.14",
                                "value": "9.0.14",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "9.0.14"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 9.0.12",
                                "value": "9.0.12",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "9.0.12"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 9.0.8",
                                "value": "9.0.8",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "9.0.8"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 9.0.0",
                                "value": "9.0.0",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "9.0.0"
                                    }
                                }
                            }
                        ]
                    },
                    {
                        "displayText": "Tomcat 8.5",
                        "value": "tomcat8.5",
                        "minorVersions": [
                            {
                                "displayText": "Tomcat 8.5",
                                "value": "8.5",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "8.5",
                                        "isAutoUpdate": true
                                    },
                                    "linuxContainerSettings": {
                                        "java11Runtime": "TOMCAT|8.5-java11",
                                        "java8Runtime": "TOMCAT|8.5-jre8",
                                        "isAutoUpdate": true
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 8.5.61",
                                "value": "8.5.61",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java8Runtime": "TOMCAT|8.5.61-java8",
                                        "java11Runtime": "TOMCAT|8.5.61-java11"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 8.5.58",
                                "value": "8.5.58",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "8.5.58"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 8.5.57",
                                "value": "8.5.57",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "8.5.57"
                                    },
                                    "linuxContainerSettings": {
                                        "java11Runtime": "TOMCAT|8.5.57-java11",
                                        "java8Runtime": "TOMCAT|8.5.57-java8"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 8.5.53",
                                "value": "8.5.53",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java11Runtime": "TOMCAT|8.5.53-java11",
                                        "java8Runtime": "TOMCAT|8.5.53-java8"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 8.5.51",
                                "value": "8.5.51",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "8.5.51"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 8.5.47",
                                "value": "8.5.47",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "8.5.47"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 8.5.42",
                                "value": "8.5.42",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "8.5.42"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 8.5.41",
                                "value": "8.5.41",
                                "stackSettings": {
                                    "linuxContainerSettings": {
                                        "java11Runtime": "TOMCAT|8.5.41-java11",
                                        "java8Runtime": "TOMCAT|8.5.41-java8"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 8.5.37",
                                "value": "8.5.37",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "8.5.37"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 8.5.34",
                                "value": "8.5.34",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "8.5.34"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 8.5.31",
                                "value": "8.5.31",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "8.5.31"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 8.5.20",
                                "value": "8.5.20",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "8.5.20"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 8.5.6",
                                "value": "8.5.6",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "8.5.6"
                                    }
                                }
                            }
                        ]
                    },
                    {
                        "displayText": "Tomcat 7.0",
                        "value": "tomcat7.0",
                        "minorVersions": [
                            {
                                "displayText": "Tomcat 7.0",
                                "value": "7.0",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "7.0",
                                        "isAutoUpdate": true
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 7.0.94",
                                "value": "7.0.94",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "7.0.94"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 7.0.81",
                                "value": "7.0.81",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "7.0.81"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 7.0.62",
                                "value": "7.0.62",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "7.0.62"
                                    }
                                }
                            },
                            {
                                "displayText": "Tomcat 7.0.50",
                                "value": "7.0.50",
                                "stackSettings": {
                                    "windowsContainerSettings": {
                                        "javaContainer": "TOMCAT",
                                        "javaContainerVersion": "7.0.50"
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        }
    ],
    "nextLink": null,
    "id": null
}`;
