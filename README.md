# lovr: LOgVieweR

LOgVieweR is a tool that enable you to view your logs in a human readable way.

### Example:

Input:
```
{"level":"info","ts":1648174276.8416204,"caller":"api/main.go:45","msg":"connecting to redis","service":"website-api","version":"dev","build":"local","build_date":"20220308","go_version":"go1.16.5","addresses":["redis:6379"]}
{"level":"info","ts":1648174276.8429966,"caller":"zapreporter/reporter.go:28","msg":"starting service","service":"website-api","version":"dev","build":"local","build_date":"20220308","go_version":"go1.16.5","dependency.service":"HTTP Server"}
```

Output
```
     Level: Info
   Message: connecting to redis
 Timestamp: 2022-03-24 23:11:16.841620445 -03:00
    Fields:
      ├─ service   : website-api
      ├─ version   : dev
      ├─ build     : local
      ├─ build_date: 20220308
      ├─ go_version: go1.16.5
      └─ addresses : [redis:6379]
    Caller: api/main.go:45
----------------------------------------
     Level: Info
   Message: starting service
 Timestamp: 2022-03-24 23:11:16.842996597 -03:00
    Fields:
      ├─ service           : website-api:wq
      ├─ version           : dev
      ├─ build             : local
      ├─ build_date        : 20220308
      ├─ go_version        : go1.16.5
      └─ dependency.service: HTTP Server
    Caller: zapreporter/reporter.go:28
----------------------------------------
EOF
```

### Installation

```
go install github.com/jamillosantos/lovr/lovr@latest
```

### Usage

Below some examples of how you can use the `lovr`:

#### Loading from a file:

For this case, imagine you have a log file called `app.log`.

```
lovr -s app.log
```

#### Listening changes in a file:

For this case, you have a process running adding logs to a `app.log`.

```
tail -f app.log | lovr
```

#### Loading from the STDOUT:

For this case, you will run your application and its STDOUT will be redirected straight
to the `lovr`. As long `yourapp` is running, `lovr` will be active converting the output.

```
./yourapp | lovr
```

#### Loading from the STDERR:

The same as above. However, in this case, instead of capturing the STDOUT, we are capturing
the STDERR.

```
./yourapp 2>&1 >/dev/null | lovr
```

#### Loading from a docker container:

In this case, we will be capturing the output of docker container. The `docker logs`
will output all the logs it has until this moment, then it will close. `lovr` will
also close when it happens.

```
docker logs c353a06afee4 | lovr
```

If you want to keep `lovr` running just add the `-f` option to the `docker logs` 
command.

```
docker logs -f c353a06afee4 2>&1 | lovr
```

#### Loading from a docker-compose container:

In this case, we will be capturing the output of docker-compose container. The 
`docker-compose logs` will output all the logs it has until this moment, then it
will close. `lovr` will also close when it happens.

```
docker-compose logs --no-log-prefix api | lovr
```

If you want to keep `lovr` running just add the `-f` option to the `docker-compose logs`
command.

```
docker-compose logs -f --no-log-prefix api | lovr
```
