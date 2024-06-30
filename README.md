# Orders

**_robot orders microserive_**

- version: 0.1.0
- author: [meok][author]
- build: axios, express, pg, ws

> Using binance API last update: `2024-06-06`

## What for

Limit creating orders in exchange to:

- reduce load on rate limit
- don't pay comission for suspended orders
- hide orders (signal prices) from users

## Exchange rate limits

[Binance rate limits](https://binance-docs.github.io/apidocs/spot/en/#change-log)
check update for `2023-08-25`

## Functions

- [x] Binance API to GET. CREATE, DELETE orders
- [x] Monitor pairs prices
- [x] Save/Load orders from DB
- [x] Internal API to CREATE, DELETE orders
- [x] Logger
- [ ] Keepalife monitor

[author]: https://bazha.ru 'meok home page'
