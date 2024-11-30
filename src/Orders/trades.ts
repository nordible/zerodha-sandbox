const faker = require('faker');
const pool = require('../db');
// Function to generate random trade data
const generateRandomTradeData = (): any[] => {
  const data = [{
    trade_id: faker.datatype.number().toString(),
    order_id: faker.datatype.number().toString(),
    exchange_order_id: faker.datatype.number().toString(),
    tradingsymbol: faker.random.alphaNumeric(6),
    exchange: 'NSE',
    instrument_token: faker.datatype.number().toString(),
    transaction_type: 'BUY',
    product: 'MIS',
    average_price: parseFloat(faker.finance.amount()),
    quantity: faker.datatype.number(),
    fill_timestamp: faker.date.past().toISOString(),
    exchange_timestamp: faker.date.past().toISOString()
  }];
  
  return data;
};

// Function to handle GET request for GETTrades
export const GETTrades = async (request: any, response: any) => {
  try {
    const { authorization } = request.headers;
    const tokenParts = authorization.split(' ');
    const [apiKey, accessToken] = tokenParts[tokenParts.length - 1].split(':');
    const client = await pool.connect();
    
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
      `SELECT o.id,
      o.exchange, 
      o.tradingsymbol, 
      o.instrument_token, 
      o.product, 
      o.quantity, 
      o.exchange_order_id, 
      o.transaction_type, 
      o.order_timestamp, 
      o.exchange_timestamp,
      o.average_price
       FROM orders o
       INNER JOIN users u ON o.user_id = u.id
       WHERE u.id = $1
       AND DATE(o.order_timestamp) = CURRENT_DATE
       AND o.status IN ($2, $3)
       ORDER BY o.order_timestamp desc`,
      [user.id, 'COMPLETE', 'ACCEPTED']
    );
  
    response.status(200).jsonp({
      "status": "success",
      "data": result.rows,
    });
    client.release();
  } catch (error) {
    response.status(500).jsonp({
      "status": "error",
      "message": error
    });
  }
};
