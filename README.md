# Orders

**_robot orders microserive_**

- version: 0.0.1
- author: [meok][author]
- build: axios, express, pg, ws

> Using binance API last update: `2023-04-20`

## Exchange rate limits

[Binance rate limits](https://binance-docs.github.io/apidocs/spot/en/#change-log)
check update for `2023-08-25`

## Functions

- [ ] Binance API to GET. CREATE, DELETE orders
- [x] Monitor pairs prices
- [x] Save/Load orders from DB
- [x] Internal API to CREATE, DELETE orders
- [x] Logger
- [ ] Keepalife monitor
- [ ] Put orders in monitor that created in exchange but not filled by timeout seconds

[author]: https://bazha.ru 'meok home page'
