export {}
const pool = require('../db');
const cron =  require('node-cron');
const minPrice = 10;
const maxPrice = 40;
const step = 0.2;
const directionMap = new Map();

const updatePrices = async () => {
  try {
    const result = await pool.query('SELECT instrument_token, last_price FROM instruments');
    const instruments = result.rows;

    for (const instrument of instruments) {
      let { instrument_token, last_price } = instrument;
      let direction = directionMap.get(instrument_token) || 'up';

      if (direction === 'up') {
        last_price += step;
        if (last_price >= maxPrice) {
          last_price = maxPrice;
          direction = 'down';
        }
      } else {
        last_price -= step;
        if (last_price <= minPrice) {
          last_price = minPrice;
          direction = 'up';
        }
      }
      last_price = parseFloat(last_price.toFixed(2));
      directionMap.set(instrument_token, direction);

      //console.log("last_price" , last_price);
      
      await pool.query(
        'UPDATE instruments SET last_price = $1 WHERE instrument_token = $2',
        [last_price, instrument_token]
      );
    }

   // console.log('Prices updated successfully.');
  } catch (error) {
    console.error('Error updating prices:', error);
  }
};


cron.schedule('*/2 * * * * *', updatePrices);
process.on('SIGINT', () => {
  pool.end(() => {
    console.log('Database connection closed.');
    process.exit(0);
  });
});
