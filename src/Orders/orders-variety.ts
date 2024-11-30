const faker = require('faker');
const pool = require('../db');
const axios = require('axios');
const { createHash } = require('crypto');
// Function to generate random order ID
const generateRandomOrderID = (): string => {
  return faker.datatype.number().toString();
};

function hash(alg: any, data: any, salt:any, enc:any) {
    if (data == null) return data;
    salt = typeof salt == 'string' ? salt : '';
    enc = typeof enc == 'string' ? enc : 'hex';
    return createHash(alg).update(data + salt).digest(enc);
}

export const POSTOrderVariety = async (request: any, response: any) => {
  const client = await pool.connect();
  try {  
    const { authorization } = request.headers;
    const tokenParts = authorization.split(' ');
    const [apiKey, accessToken] = tokenParts[tokenParts.length - 1].split(':');
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
      return;
    }
    const {
      tradingsymbol,
      exchange,
      transaction_type,
      order_type,
      quantity,
      product,
      validity,
      price,
    } = request.body;
    const { variety } = request.params; 

    const instrumentQuery = await client.query(
      'SELECT instrument_token FROM instruments WHERE tradingsymbol = $1',
      [tradingsymbol]
    );  
    const instrument = instrumentQuery.rows[0];

    const average_price = price;
    const filled_quantity = quantity;
   
    if (!instrument) {
      const topTradingSymbolsQuery = await client.query(
        'SELECT tradingsymbol FROM instruments LIMIT 10'
      );
      const topTradingSymbols = topTradingSymbolsQuery.rows.map(
        (symbolObj: any) => symbolObj.tradingsymbol
      );

      response.status(404).jsonp({
        status: 'error',
        message: 'Trading symbol not found',
        top_10_trading_symbols: topTradingSymbols,
      });
      return;
    }

    const orderID = generateRandomOrderID();

    await client.query(
      `
      INSERT INTO orders (
        id,
        user_id,
        instrument_token,
        tradingsymbol,
        exchange,
        transaction_type,
        order_type,
        quantity,
        product,
        validity,
        status,
        variety,
        price,
        order_timestamp,
        placed_by,
        average_price,
        filled_quantity
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16 , $17)
    `,
      [
        orderID,
        user.id,
        instrument.instrument_token,
        tradingsymbol,
        exchange,
        transaction_type,
        order_type,
        quantity,
        product,
        validity,
        'ACCEPTED',
        variety,
        price,
        (new Date().toISOString()),
        'T-ASSIT',
        average_price,
        filled_quantity
      ]
    );
    ;
    
    await calculateAndInsertPositions(client, orderID);
    simulateDelayedPostback(client, orderID)
    const responseData = {
      status: 'success',
      data: {
        order_id: orderID,
      },
    };
   
    response.status(200).jsonp(responseData);
    
  } catch (error) {
    console.error('Error placing order:', error);
    response.status(500).jsonp({
      status: 'error',
      message: 'Error placing order',
    });
  } finally{
    console.log("Reached Finally for orders block");
    
    client.release();
  }
};


export const PUTOrderVariety = async (request: any, response: any) => {
  try {
    const orderID = request.params.orderId;
    const {
      order_type,
      quantity,
      price,
      trigger_price,
      disclosed_quantity,
      validity
    } = request.body; 

    // Update order details in the database
    const client = await pool.connect();

    await client.query(`
      UPDATE orders 
      SET order_type = $1, quantity = $2, price = $3, trigger_price = $4, disclosed_quantity = $5, validity = $6
      WHERE id = $7
    `, [order_type, quantity, price, trigger_price, disclosed_quantity, validity, orderID]);

    await calculateAndInsertPositions(client, orderID);
    ;
    response.status(200).jsonp({
      "status": "success",
      "data": {
        "order_id": orderID
      }
    });
  } catch (error) {
    console.error('Error modifying order:', error);
    response.status(500).jsonp({
      "status": "error",
      "message": "Error modifying order"
    });
  }
};
// Function to handle DELETE request for DELETEOrderVariety
export const DELETEOrderVariety = (request: any, response: any) => {
  const orderID = generateRandomOrderID(); // Generating random order ID
  response.status(200).jsonp({
    "status": "success",
    "data": {
      "order_id": orderID
    }
  });
};


// Function to calculate and insert positions
const calculateAndInsertPositions = async (client: any, orderID: any) => {
  try {
    // Begin a transaction
    await client.query('BEGIN');

    // Calculate and insert data into positions table for a specific order_id
    const insertQuery = `
      INSERT INTO portfolio_positions (
        order_id,
        average_price,
        close_price,
        value,
        pnl,
        m2m,
        unrealised,
        realised
      )
      SELECT
        o.id AS order_id,
        AVG(o.price) AS average_price,
        MAX(o.price) AS close_price,
        SUM(o.price * o.quantity) AS value,
        SUM(CASE WHEN o.transaction_type = 'SELL' THEN (o.quantity * o.price - o.quantity * o.average_price) ELSE 0 END) AS pnl,
        SUM(CASE WHEN o.transaction_type = 'SELL' THEN (o.quantity * o.price - o.quantity * o.average_price) ELSE 0 END) AS m2m,
        SUM(CASE WHEN o.transaction_type = 'SELL' THEN (o.quantity * o.price - o.quantity * o.average_price) ELSE 0 END) AS unrealised,
        SUM(CASE WHEN o.transaction_type = 'SELL' THEN (o.quantity * o.price - o.quantity * o.average_price) ELSE 0 END) AS realised
      FROM
        orders o
      WHERE
        o.id = $1
      GROUP BY
        o.id, o.instrument_token
    `;

    await client.query(insertQuery, [orderID]);
    await client.query('COMMIT');

    console.log(`Positions calculated and inserted for order_id: ${orderID} successfully.`);
  } catch (error) {
    console.error(`Error calculating and inserting positions for order_id: ${orderID}`, error);
  }
};

const postback_url = process.env.POSTBACK_URL || 'http://localhost:8100/api/z-postback'

async function simulateDelayedPostback(client:any, orderId: any) {
try {

  const status = Math.random() < 0.9 ? 'COMPLETE' : 'REJECTED';
  const updateStatusQuery = `
    UPDATE orders
    SET status = $1
    WHERE id = $2
    RETURNING *;
  `;
  await client.query(updateStatusQuery, [status, orderId]);

  const orderQuery = await client.query(
    `SELECT * FROM orders WHERE id = $1`,
    [orderId]
  );
  if (orderQuery.rows.length > 0) {
    const orderDetails = orderQuery.rows[0];
    console.log(orderDetails);
    
    const query = {
      text: 'SELECT api_secret FROM users WHERE id = $1',
      values: [orderDetails.user_id],
    };
  
  const result = await client.query(query);
  const api_secret = result.rows[0].api_secret;
  const checksum = hash("sha256",( orderId + orderDetails.order_timestamp.toISOString() + api_secret),null,null);
 
  if(orderDetails.order_type != 'LIMIT')
  {
    orderDetails.price = 0;
  }
  
    const updatedStatusPayload = {
      "user_id": orderDetails.user_id,
      "unfilled_quantity": 0,
      "app_id": 93076,
      "checksum": checksum,
      "placed_by": orderDetails.placed_by,
      "order_id": orderId,
      "exchange_order_id": orderDetails.exchange_order_id,
      "parent_order_id": orderDetails.parent_order_id,
      "status": orderDetails.status,
      "status_message": orderDetails.status_message,
      "order_timestamp": orderDetails.order_timestamp,
      "exchange_update_timestamp": orderDetails.exchange_timestamp,
      "exchange_timestamp": orderDetails.exchange_timestamp,
      "variety": orderDetails.variety,
      "exchange": orderDetails.exchange,
      "tradingsymbol": orderDetails.tradingsymbol,
      "instrument_token": orderDetails.instrument_token,
      "order_type": orderDetails.order_type,
      "transaction_type": orderDetails.transaction_type,
      "validity": orderDetails.validity,
      "product": orderDetails.product,
      "quantity": orderDetails.quantity,
      "disclosed_quantity": orderDetails.disclosed_quantity,
      "price": orderDetails.price,
      "trigger_price": orderDetails.trigger_price,
      "average_price": orderDetails.average_price,
      "filled_quantity": orderDetails.filled_quantity,
      "pending_quantity": orderDetails.pending_quantity,
      "cancelled_quantity": 0,
      "market_protection": orderDetails.market_protection,
      "meta": {},
      "tag": orderDetails.tag,
      "guid": "93076XWl1mzshtvIgb"
    };
   
    sendPostbackUpdate(updatedStatusPayload);

    setTimeout(() => {
    }, 10000);
  } else {
    console.log("Order ID not found or user not associated with the order.");
  }

  ;
} catch (error) {
  console.error("Error executing PostgreSQL query:", error);
}
}


// Function to send a POST request with the payload
function sendPostbackUpdate(payload: any) {
  // Your API endpoint URL

  const apiUrl = 'http://localhost:5688/webhook/z-postback';
  console.log(apiUrl, payload);
  
  const headers = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  axios.post(apiUrl,  JSON.stringify(payload), headers)
    .then((response: { data: any; }) => {
    })
    .catch((error: any) => {
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
      } else {
        console.error('Error message:', error.message);
      }
    });
  }
