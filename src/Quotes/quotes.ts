const faker = require('faker');
const pool = require('../db');

// Function to generate random quotes data for GetQuotes
const generateRandomQuotesData = (): any => {
  const data = {
    "41729": {
      "instrument_token": 41729,
      "timestamp": faker.date.past().toISOString(),
      "last_price": parseFloat(faker.finance.amount()),
      "last_quantity": faker.datatype.number(),
      "last_trade_time": faker.date.past().toISOString(),
      "average_price": parseFloat(faker.finance.amount()),
      "volume": faker.datatype.number(),
      "buy_quantity": faker.datatype.number(),
      "sell_quantity": faker.datatype.number(),
      "ohlc": {
        "open": parseFloat(faker.finance.amount()),
        "high": parseFloat(faker.finance.amount()),
        "low": parseFloat(faker.finance.amount()),
        "close": parseFloat(faker.finance.amount())
      },
      "net_change": faker.datatype.number(),
      "oi": faker.datatype.number(),
      "oi_day_high": faker.datatype.number(),
      "oi_day_low": faker.datatype.number(),
      "depth": {
        "buy": Array.from({ length: 5 }, () => ({
          "price": parseFloat(faker.finance.amount()),
          "quantity": faker.datatype.number(),
          "orders": faker.datatype.number()
        })),
        "sell": Array.from({ length: 5 }, () => ({
          "price": parseFloat(faker.finance.amount()),
          "quantity": faker.datatype.number(),
          "orders": faker.datatype.number()
        }))
      }
    },
    "NSE:INFY": {
      "instrument_token": 408065,
      "timestamp": faker.date.past().toISOString(),
      "last_price": parseFloat(faker.finance.amount()),
      "last_quantity": faker.datatype.number(),
      "last_trade_time": faker.date.past().toISOString(),
      "average_price": parseFloat(faker.finance.amount()),
      "volume": faker.datatype.number(),
      "buy_quantity": faker.datatype.number(),
      "sell_quantity": faker.datatype.number(),
      "ohlc": {
        "open": parseFloat(faker.finance.amount()),
        "high": parseFloat(faker.finance.amount()),
        "low": parseFloat(faker.finance.amount()),
        "close": parseFloat(faker.finance.amount())
      }
    }
  };
  return data;
};

// Function to generate random OHLC data for GetQuotesOHLC
const generateRandomOHLCData = (): any => {
  const data = {
    "BSE:SENSEX": {
      "instrument_token": 265,
      "last_price": parseFloat(faker.finance.amount()),
      "ohlc": {
        "open": parseFloat(faker.finance.amount()),
        "high": parseFloat(faker.finance.amount()),
        "low": parseFloat(faker.finance.amount()),
        "close": parseFloat(faker.finance.amount())
      }
    },
    "NSE:INFY": {
      "instrument_token": 408065,
      "last_price": parseFloat(faker.finance.amount()),
      "ohlc": {
        "open": parseFloat(faker.finance.amount()),
        "high": parseFloat(faker.finance.amount()),
        "low": parseFloat(faker.finance.amount()),
        "close": parseFloat(faker.finance.amount())
      }
    },
    "NSE:NIFTY 50": {
      "instrument_token": 256265,
      "last_price": parseFloat(faker.finance.amount()),
      "ohlc": {
        "open": parseFloat(faker.finance.amount()),
        "high": parseFloat(faker.finance.amount()),
        "low": parseFloat(faker.finance.amount()),
        "close": parseFloat(faker.finance.amount())
      }
    }
  };
  return data;
};

// Function to generate random last price data for GetQuotesLTP
const generateRandomLTPData = (): any => {
  const data = {
    "BSE:SENSEX": {
      "instrument_token": 265,
      "last_price": parseFloat(faker.finance.amount())
    },
    "NSE:INFY": {
      "instrument_token": 408065,
      "last_price": parseFloat(faker.finance.amount())
    },
    "NSE:NIFTY 50": {
      "instrument_token": 256265,
      "last_price": parseFloat(faker.finance.amount())
    }
  };
  return data;
};

// Function to handle GET request for GetQuotes
export const GetQuotes = (request: any, response: any) => {
  const randomQuotesData = generateRandomQuotesData();
  response.status(200).jsonp({
    "status": "success",
    "data": randomQuotesData,
  });
};

// Function to handle GET request for GetQuotesOHLC
export const GetQuotesOHLC = async(request: any, response: any) => {
  const { i } = request.query;
  const [exchange, symbol] = i.split(':');

  if (!exchange || !symbol) {
    return response.status(400).json({ error: 'Please provide proper parameters' });
  }

  const { authorization } = request.headers;
  if (!authorization) {
    return response.status(401).json({ message: 'Authorization header missing' });
  }
  try {
    const tokenParts = authorization.split(' ');
    const [apiKey, accessToken] = tokenParts[tokenParts.length - 1].split(':');
    const client = await pool.connect();
    
    // Fetch user_id based on the provided api_key and access_token
    const userQuery = await client.query(
      'SELECT id FROM users WHERE api_key = $1 AND access_token = $2',
      [apiKey, accessToken]
    );
    const user = userQuery.rows[0];
    
    if (!user) {
      response.status(401).jsonp({
        "status": "error",
        "message": "Unauthorized access",
      });
      ;
      return;
    }

    const result = await client.query(
      'SELECT instrument_token , last_price FROM instruments WHERE exchange = $1 AND tradingsymbol = $2',
      [exchange, symbol]
    );

    response.status(200).jsonp({
      status: "success",
      data: result.rows.map((row: { last_price: number , instrument_token : number }) => ({
        [`${exchange}:${symbol}`]: {
          instrument_token: row.instrument_token, 
          last_price: row.last_price,
          ohlc: {
            open: parseFloat(faker.finance.amount()),
            high: parseFloat(faker.finance.amount()),
            low: parseFloat(faker.finance.amount()),
            close: row.last_price
          }
        }
      }))
    });
    client.release();
  } catch (error) {
    response.status(500).jsonp({
      "status": "error",
      "message": "Failed to fetch last_price",
    });
  }
  /*const randomOHLCData = generateRandomOHLCData();
  response.status(200).jsonp({
    "status": "success",
    "data": randomOHLCData,
  });*/
};

// Function to handle GET request for GetQuotesLTP
export const GetQuotesLTP = (request: any, response: any) => {
  const randomLTPData = generateRandomLTPData();
  response.status(200).jsonp({
    "status": "success",
    "data": randomLTPData,
  });
};
