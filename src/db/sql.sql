CREATE TABLE IF NOT EXISTS public.monitor_order (
    id INT NOT NULL GENERATED BY DEFAULT AS IDENTITY,
    created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bot_id INT NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL,
    quantity FLOAT NOT NULL,
    price FLOAT NOT NULL,
    fee FLOAT NOT NULL,
    "time" INT NOT NULL,
    expire INT NOT NULL,
    filled BOOLEAN NOT NULL DEFAULT false,
    order_id INT NOT NULL DEFAULT 0,

    CONSTRAINT monitor_order_pkey PRIMARY KEY (id),
  	CONSTRAINT monitor_order_order_id_check CHECK ((order_id >= 0)),
  	CONSTRAINT monitor_order_time_check CHECK (("time" >= 0)),
    CONSTRAINT monitor_order_bot_id_fk_subscribers_bot_id FOREIGN KEY (bot_id) REFERENCES public.subscribers_bot(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS monitor_order_bot_id ON public.monitor_order USING btree (bot_id);
CREATE INDEX IF NOT EXISTS monitor_order_time ON public.monitor_order USING btree ("time");