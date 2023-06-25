CREATE TABLE IF NOT EXISTS mining_accounts (
    id SERIAL NOT NULL PRIMARY KEY,
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id VARCHAR(24) NOT NULL,
    acc_name VARCHAR NOT NULL,
    pay_adderss INT NULL,
    pay_min INT NULL,
    CONSTRAINT "UQ_acc_name" UNIQUE (acc_name),
  	CONSTRAINT accounts_fk FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS mining_workers (
    id SERIAL NOT NULL PRIMARY KEY,
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acc_id INT NOT NULL,
    worker_name VARCHAR NOT NULL,
    difficulty INT NULL,
    hashrate INT NOT NULL DEFAULT 0,
    last_online TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "UQ_acc_workers" UNIQUE (acc_id, worker_name),
  	CONSTRAINT accounts_fk FOREIGN KEY (acc_id) REFERENCES mining_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS mining_incomes (
    id SERIAL NOT NULL PRIMARY KEY,
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    worker_id INT NOT NULL,
    hashrate INT NOT NULL,
    shares_amount INT NOT NULL,
    pay_amount FLOAT8 NOT NULL,
    is_payed BOOLEAN NOT NULL DEFAULT false,
  	CONSTRAINT workers_fk FOREIGN KEY (worker_id) REFERENCES mining_workers(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS mining_pays (
    id SERIAL NOT NULL PRIMARY KEY,
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acc_id INT NOT NULL,
    pay_address VARCHAR NOT NULL,
    amount INT NOT NULL,
  	CONSTRAINT accounts_fk FOREIGN KEY (acc_id) REFERENCES mining_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS mining_blocks (
    id SERIAL NOT NULL PRIMARY KEY,
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    worker_id INT NOT NULL,
    block_height INT NOT NULL,
    block_hash VARCHAR NOT NULL,
    pow_amount INT NOT NULL,
    is_payed BOOLEAN NOT NULL DEFAULT false,
  	CONSTRAINT workers_fk FOREIGN KEY (worker_id) REFERENCES mining_workers(id) ON DELETE SET NULL ON UPDATE CASCADE
);
