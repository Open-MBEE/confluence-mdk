# confluence-mdk

This CLI tool allows you to export the page structure and contents of Wiki pages from a Confluence space as RDF.

## Contents
 - Install
   - [from Docker Hub](#install-from-docker-hub)
   - [from NPM](#install-from-npm)
   - [from source](#install-from-source)
 - [CLI Usage](#cli)
   - [`export` command](#cli-export)
   - [`neptune` command](#cli-neptune)


## Install from Docker Hub

Running this tool as a docker container is the simplest method for getting started.

**Requirements:**
 - [Docker](https://www.docker.com/get-started)

**Install:**
```console
$ docker pull openmbee/confluence-mdk:latest
```

**Prepare:**
Create a file to store configuration and user credentials that the tool will use to connect to Confluence wiki:

For example, in a file called `.docker-env`
```bash
CONFLUENCE_SERVER=https://mms.xyz.org
CONFLUENCE_USER=user
CONFLUENCE_PASS=pass
```

**Run:**
```console
$ docker run -it --init --rm --env-file .docker-env openmbee/confluence-mdk:latest export --help
```

The above shell command will print the help message for the `export` command.

The `-it --init` options will allow you to interactively cancel and close the command while it is running through your terminal.

The `--rm` option will remove the stopped container from your file system once it exits.

The `--env-file .docker-env` option points docker to your environments variables file.



## Install from NPM

**Requirements:**
 - Node.js >= v14.13.0

> If running on a personal machine and you do not already have Node.js installed, `webi` is the recommended install method since it will automatically configure node and npm for you:
[https://webinstall.dev/node/](https://webinstall.dev/node/)


Install the package globally:

```console
$ npm install -g confluence-mdk
```

Confirm the CLI is linked:

```console
$ confluence-mdk --version
```

If the above works, congrats! You're good to go.

However, if you got an error, it is likely that your npm has not yet been configured on where to put global packages.

For Linux and MacOS:
```
$ mkdir ~/.npm-global
$ echo -e "export NPM_CONFIG_PREFIX=~/.npm-global\nexport PATH=\$PATH:~/.npm-global/bin" >> ~/.bashrc
$ source ~/.bashrc
```


## Install from source

This approach is for developers who wish to edit the source code for testing changes.

From the project's root directory:
```console
$ npm install
```

To link the CLI, you can use:
```console
$ npm link
```

If running on a personal machine, it is suggested to [set your npm prefix](https://stackoverflow.com/a/23889603/14284216) so that the CLI is not linked globally.

## CLI

The CLI has one command, `export`. It writes the output RDF (as Turtle) to stdout, all logs and warnings are written to stderr:

```console
confluence-mdk export ROOT_CONFLUENCE_WIKI_PAGE OPTIONS... > output_file.ttl

Positionals:
  ROOT_CONFLUENCE_WIKI_PAGE  URL of the top root page to export; or its page id; or "space/title"
                             of page                                            [string] [required]

Options:
  --server  URL to Confluence server; or use environment variable CONFLUENCE_SERVER        [string]
  --help    Show help                                                                     [boolean]

Environment Variables:
  CONFLUENCE_SERVER      URL for Confluence server
  CONFLUENCE_USER        Username for Confluence auth
  CONFLUENCE_PASS        Password for Confluence auth
```

For local testing, it is recommended that your create a `.env` file with all the enviornment variables (docker users skip this step):

For Linux and MacOS:
```bash
#!/bin/bash
export CONFLUENCE_SERVER=https://wiki.xyz.org
export CONFLUENCE_USER=user
export CONFLUENCE_PASS=pass
```

Then, simply `$ source .env` before running the CLI.

For Windows:
```powershell
set CONFLUENCE_SERVER=https://wiki.xyz.org
set CONFLUENCE_USER=user
set CONFLUENCE_PASS=pass
```

### CLI: Export

Use `confluence-mdk export --help` for the latest documentation about this command's options.

This command will export the contents of the given root page and all of its descdendents, as well as the wiki structure between them (i.e., the parent/child relationships).

Say we have a root wiki page at `https://wiki.xyz.org/display/somespace/PageTitle` on our server and we want to export it along with all of its descendents:
```console
$ confluence-mdk export https://wiki.xyz.org/display/somespace/PageTitle > wiki-export.ttl
```


### CLI: Neptune

Use `confluence-mdk neptune --help` for the latest documentation about this command's options.

This command provides some basic control over a Neptune instance for (re)loading RDF data from your local machine to an S3 bucket and then triggering Neptune's bulk loader on that bucket.

For now, the only subcommand available is `neptune import`, which does the following tasks in listed order:
 1. Uploads the Turtle stream on stdin to an S3 object named `stdin.ttl` (overwriting the remote object if it already exists), prepending the given `--prefix` to the object name.
 2. Uploads the Turtle file `./src/asset/ontology.ttl` to an S3 object named `ontology.ttl` (overwriting the remote object if it already exists), prepending the given `--prefix` to the object name.
 2. Clears the specified named graph on the Neptune instance given by `--graph`.
 3. Invokes a bulk load command on the Neptune instance to load all objects as RDF files under the given `--prefix` S3 prefix (which should include `stdin.ttl` and `ontology.ttl`).
 4. Logs the outputs to stdout.

For this command, the following environment variables need to be set:

 - `NEPTUNE_REGION` - the AWS region in which the Neptune cluster is located
 - `NEPTUNE_S3_BUCKET_URL` - the `s3://...` bucket URL
 - `NEPTUNE_S3_IAM_ROLE_ARN` - the ARN associated with the Neptune cluster's role for loading data from S3
 - `AWS_ACCESS_KEY_ID`  - AWS access key id
 - `AWS_SECRET_ACCESS_KEY` - AWS secret access key
 - `SPARQL_ENDPOINT` - the public URL to the SPARQL endpoint exposed by the Neptune cluster
 - `SPARQL_PROXY` - optional URL to a proxy used for sending requests to SPARQL endpoint (requests must originate from a machine within same VPC as cluster, using proxy here allows you to send HTTP(S) requests thru ssh tunnel you open to ec2 machine)

#### `import` Options:
 - `--prefix` -- string to prepend to the S3 objects, e.g., `my-folder/`
 - `--graph` -- IRI of the named graph to load all the RDF data into, e.g., `https://wiki.xyz.org/display/Space+Rocks`

An example command:
```console
$ confluence-mdk neptune import --prefix wiki-rdf/ --graph  https://wiki.xyz.org/display/somespace < wiki-export.ttl
```

