const axios = require('axios');
const curlirize = require('axios-curlirize').default;

curlirize(axios);

module.exports = axios;
