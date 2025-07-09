import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

const API_KEY = process.env.APILAYER_EXCHANGERATES_DATA_TIMESERIES

const server = new McpServer({
  name: "weather",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

async function makeNWSRequest(url) {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

function formatAlert(feature) {
  const props = feature.properties;
  return [
    `Event: ${props.event || "Unknown"}`,
    `Area: ${props.areaDesc || "Unknown"}`,
    `Severity: ${props.severity || "Unknown"}`,
    `Status: ${props.status || "Unknown"}`,
    `Headline: ${props.headline || "No headline"}`,
    "---",
  ].join("\n");
}

function historyRates(startDate, endDate, base = "USD", symbols = "CNY") {
  var myHeaders = new Headers();
  // console.log('process.env.APILAYER_EXCHANGERATES_DATA_TIMESERIES', process.env.APILAYER_EXCHANGERATES_DATA_TIMESERIES)
  myHeaders.append("apikey", process.env.APILAYER_EXCHANGERATES_DATA_TIMESERIES);

  var requestOptions = {
    method: 'GET',
    redirect: 'follow',
    headers: myHeaders
  };

  return fetch(`https://api.apilayer.com/exchangerates_data/timeseries?start_date=${startDate}&end_date=${endDate}&base=${base}&symbols=${symbols}`, requestOptions)
    .then(response => response.json())
    .catch(error => {
      console.log('error', error);
      return error;
    }
    );
}

function randomQinghua() {
  var requestOptions = {
    method: 'GET',
  };

  return fetch(`https://api.uomg.com/api/rand.qinghua?format=json`, requestOptions)
    .then(response => response.json())
    .catch(error => {
      console.log('error', error);
      return error;
    }
    );
}

server.tool(
  "random-qing-hua",
  "随机返回一段土味情话",
  {
  },
  async ({ }) => {
    const res = await randomQinghua();
    try {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    } catch (error) {
      // 处理错误，例如返回一个错误消息给调用者
      return {
        content: [
          {
            type: "text",
            text: `Error fetching historical rates: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "get-history-rates",
  "Get historical exchange rates",
  {
    startDate: z.string().describe("Start date in YYYY-MM-DD format"),
    endDate: z.string().describe("End date in YYYY-MM-DD format"),
    base: z.string().default("USD").describe("Base currency (default: USD)"),
    symbols: z.string().default("CNY").describe("Comma-separated list of target currencies (default: CNY)"),
  },
  async ({ startDate, endDate, base, symbols }) => {
    const his = await historyRates(startDate, endDate, base, symbols);
    try {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(his, null, 2),
          },
        ],
      };
    } catch (error) {
      // 处理错误，例如返回一个错误消息给调用者
      return {
        content: [
          {
            type: "text",
            text: `Error fetching historical rates: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "get-alerts",
  "Get weather alerts for a state",
  {
    state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
  },
  async ({ state }) => {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest(alertsUrl);

    if (!alertsData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve alerts data",
          },
        ],
      };
    }

    const features = alertsData.features || [];
    if (features.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No active alerts for ${stateCode}`,
          },
        ],
      };
    }

    const formattedAlerts = features.map(formatAlert);
    const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join(
      "\n"
    )}`;

    return {
      content: [
        {
          type: "text",
          text: alertsText,
        },
      ],
    };
  }
);

server.tool(
  "get-forecast",
  "Get weather forecast for a location",
  {
    latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .describe("Longitude of the location"),
  },
  async ({ latitude, longitude }) => {
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(
      4
    )},${longitude.toFixed(4)}`;

    // return {
    //   content: [
    //     {
    //       type: "text",
    //       text: `Forecast for ${latitude}, ${longitude}:\n\n${[0,1,2,3].join(
    //   "\n"
    // )}`,
    //     },
    //   ],
    // };

    console.log('pointsUrl', pointsUrl)

    const pointsData = await makeNWSRequest(pointsUrl);
    console.log('pointsData', pointsData)
    if (!pointsData) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
          },
        ],
      };
    }

    const forecastUrl = pointsData.properties?.forecast;
    console.log('forecastUrl', forecastUrl)
    if (!forecastUrl) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to get forecast URL from grid point data",
          },
        ],
      };
    }

    const forecastData = await makeNWSRequest(forecastUrl);
    console.log('forecastData', forecastData)
    if (!forecastData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve forecast data",
          },
        ],
      };
    }

    const periods = forecastData.properties?.periods || [];
    console.log('periods', periods)
    if (periods.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No forecast periods available",
          },
        ],
      };
    }

    const formattedForecast = periods.map((period) =>
      [
        `${period.name || "Unknown"}:`,
        `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"
        }`,
        `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
        `${period.shortForecast || "No forecast available"}`,
        "---",
      ].join("\n")
    );
    console.log('formattedForecast', formattedForecast)
    const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join(
      "\n"
    )}`;

    return {
      content: [
        {
          type: "text",
          text: forecastText,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
