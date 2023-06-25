-- create schema if not exists pooldb;

create sequence if not exists seq_bans;
create sequence if not exists seq_users;
create sequence if not exists seq_accounts;
create sequence if not exists seq_workers;
create sequence if not exists seq_shares;
create sequence if not exists seq_incomes;
create sequence if not exists seq_pays;
create sequence if not exists seq_blocks;


CREATE TABLE IF NOT EXISTS bans (
    id INT NOT NULL DEFAULT nextval('seq_bans'::regclass),
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip VARCHAR NOT NULL,
    reason VARCHAR NOT NULL,
    CONSTRAINT "PK_bans" PRIMARY KEY (id),
    CONSTRAINT "UQ_nan_ip" UNIQUE (ip)
);

CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL DEFAULT nextval('seq_users'::regclass),
    login VARCHAR NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PK_users" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS accounts (
    id INT NOT NULL DEFAULT nextval('seq_accounts'::regclass),
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id INT NOT NULL,
    acc_name VARCHAR NOT NULL,
    pay_adderss INT NULL,
    pay_min INT NULL,
    CONSTRAINT "PK_accounts" PRIMARY KEY (id),
    CONSTRAINT "UQ_acc_name" UNIQUE (acc_name),
  	CONSTRAINT users_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS workers (
    id INT NOT NULL DEFAULT nextval('seq_workers'::regclass),
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acc_id INT NOT NULL,
    worker_name VARCHAR NOT NULL,
    difficulty INT NULL,
    hashrate INT NOT NULL DEFAULT 0,
    last_online TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_workers" PRIMARY KEY (id),
    CONSTRAINT "UQ_acc_workers" UNIQUE (acc_id, worker_name),
  	CONSTRAINT accounts_fk FOREIGN KEY (acc_id) REFERENCES accounts(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS shares (
    id INT NOT NULL DEFAULT nextval('seq_shares'::regclass),
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    worker_id INT NOT NULL,
    job_diff INT NOT NULL,
    is_valid BOOLEAN NOT NULL,
    block_hash VARCHAR NULL,

    CONSTRAINT "PK_shares" PRIMARY KEY (id),
  	CONSTRAINT workers_fk FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS incomes (
    id INT NOT NULL DEFAULT nextval('seq_incomes'::regclass),
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    worker_id INT NOT NULL,
    hashrate INT NOT NULL,
    shares_amount INT NOT NULL,
    pay_amount FLOAT8 NOT NULL,
    is_payed BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PK_incomes" PRIMARY KEY (id),
  	CONSTRAINT workers_fk FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS pays (
    id INT NOT NULL DEFAULT nextval('seq_pays'::regclass),
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acc_id INT NOT NULL,
    pay_address VARCHAR NOT NULL,
    amount INT NOT NULL,
    CONSTRAINT "PK_pays" PRIMARY KEY (id),
  	CONSTRAINT accounts_fk FOREIGN KEY (acc_id) REFERENCES accounts(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS blocks (
    id INT NOT NULL DEFAULT nextval('seq_blocks'::regclass),
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    worker_id INT NOT NULL,
    block_height INT NOT NULL,
    block_hash VARCHAR NOT NULL,
    pow_amount INT NOT NULL,
    is_payed BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PK_blocks" PRIMARY KEY (id),
  	CONSTRAINT workers_fk FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE SET NULL ON UPDATE CASCADE
);
