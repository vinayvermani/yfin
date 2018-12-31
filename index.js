const axios = require("axios");
var decode = require("unescape");
var fs = require("fs");


var quoteUrl = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=";
var optionUrl = "https://query2.finance.yahoo.com/v7/finance/options";
var symbols = ["AAPL", "SPY","SPYG","GOOG","AMZN","ATVI","FB","XLV","XLK","BRK-B"];
//var symbols = ["BRK-B"]
//var today = parseInt(new Date().getTime() / 1000);

var myfn = function(symbol) {
  return getOptions(symbol).then(function(data) {
    var expirationDates = data.expirationDates.filter(function(date){
        return (new Date(date*1000).getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000) < 1200
    })

    //var latestExpiry = data.expirationDates[data.expirationDates.length - 1];
    var latestExpiry = expirationDates[expirationDates.length-1];
    return Promise.all([
      getOptions(symbol, latestExpiry),
      getQuote(symbol),
      getSummaryQuote(symbol)
    ]).then(function(data) {
      var optionsData = data[0];
      var qoute = data[1];
      var summaryQoute = data[2];
      //console.log(data[1]);
      var calls = optionsData.options[0].calls
        .filter(call => call.inTheMoney)
        .map(function(call) {
          var averagePrice = roundedNumber((call.bid + call.ask) / 2);
          var expiration = new Date(
            optionsData.options[0].expirationDate * 1000
          );
          var premium = roundedNumber(
            averagePrice + call.strike - qoute.regularMarketPrice
          );
          var leveragePercent = roundedNumber(
            (call.strike / qoute.regularMarketPrice) * 100
          );
          var dividend = qoute.trailingAnnualDividendYield
            ? qoute.trailingAnnualDividendYield
            : summaryQoute.defaultKeyStatistics.yield.raw;
            
          dividend = dividend ? roundedNumber(dividend * 100) : 0;
          
          var daysRemaining = Math.round(
            (expiration.getTime() - new Date().getTime()) /
              (24 * 60 * 60 * 1000)
          );
          var leverageInterest = roundedNumber(
            (dividend / call.strike) * qoute.regularMarketPrice +
              ((premium / call.strike) * 100) / (daysRemaining / 365)
          );

          return {
            shortName: qoute.shortName,
            longName: qoute.longName,
            symbol: qoute.symbol,
            expiration: expiration,
            currency: qoute.currency,
            dividend: dividend,
            regularMarketPrice: qoute.regularMarketPrice,
            strike: call.strike,
            bid: call.bid,
            ask: call.ask,
            averagePrice: averagePrice,
            premium: premium,
            leveragePercent: leveragePercent,
            leverageInterest: leverageInterest,
            daysRemaining: daysRemaining
          };
        });
      return calls;
    });
    //console.log(calls);
  });
};

//myfn("SPY").then(console.log);
//console.log("shortName;expiration;currentPrice;strike;bid;ask;leverageInterest")
Promise.all(
  symbols.map(function(symbol) {
    return myfn(symbol);
  })
).then(function(results){
    fs.writeFileSync("result",JSON.stringify(results));
    /*results.forEach(stock=>{
        stock.forEach(option=>{
            //console.log(option);
            //fs.w("result",`${option.longName};${option.expiration.toDateString()};${option.regularMarketPrice};${option.strike};${option.bid};${option.ask};${option.leverageInterest}`);
            console.log(`${option.longName};${option.expiration.toDateString()};${option.regularMarketPrice};${option.strike};${option.bid};${option.ask};${option.leverageInterest}`);
        })
    })*/
});

function getOptions(symbol, date) {
  var url = date
    ? `${optionUrl}/${symbol}?date=${date}`
    : `${optionUrl}/${symbol}`;
  return new Promise(function(resolve, reject) {
    axios
      .get(url)
      .then(function(response) {
        var data = response.data.optionChain.result[0];
        resolve(data);
      })
      .catch(function(err) {
        reject(err);
      });
  });
}

function getQuote(symbol) {
  return new Promise(function(resolve, reject) {
    axios.get(quoteUrl + symbol.toString() + "").then(function(response) {
      return resolve(response.data.quoteResponse.result[0]);
    });
  });
}

function roundedNumber(input) {
  return Math.round(input * 1000) / 1000;
}

function getSummaryQuote(symbol) {
  var url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=summaryProfile%2CfinancialData%2CrecommendationTrend%2CupgradeDowngradeHistory%2Cearnings%2CdefaultKeyStatistics%2CcalendarEvents%2CesgScores%2Cdetails`;
  return new Promise(function(resolve, reject) {
    axios.get(url).then(function(response) {
      return resolve(response.data.quoteSummary.result[0]);
    });
  });
}

//getSummaryQuote("SPY").then(data=>console.log(data.defaultKeyStatistics.yield.raw));
