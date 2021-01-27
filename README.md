# confluence-mdk

This CLI tool allows you to export the page structure and contents of Wiki pages from a Confluence space as RDF.

## Contents
 - Install
   - [from Docker Hub](#install-from-docker-hub)
   - [from NPM](#install-from-npm)
   - [from source](#install-from-source)
 - [CLI Usage](#cli)
   - [`wiki` command](#cli-export)
     - [`export` subcommand](#cli-wiki-export)
     - [`child-pages` subcommand](#cli-wiki-child-pages)
   - [`s3` command](#cli-export)
     - [`upload-data` subcommand](#cli-s3-upload-data)
     - [`upload-ontology` subcommand](#cli-s3-upload-ontology)
   - [`neptune` command](#cli-neptune)
     - [`clear` subcommand](#cli-neptune-clear)
     - [`load` subcommand](#cli-neptune-load)
   - [`import` command](#cli-import)
 - [API Usage](#api)
   - [`wikiExport`](#api-wikiexport)
   - [`wikiChildPages`](#api-wikichildpages)
   - [`s3UploadData`](#api-s3uploaddata)
   - [`s3UploadOntology`](#api-s3uploadontology)
   - [`ExportConfig`](#api-exportconfig)
   - [`neptuneClear`](#api-neptuneclear)
   - [`neptuneLoad`](#api-neptuneload)
   - [`runImport`](#api-runimport)
   - [`ImportConfig`](#api-importconfig)


## Install from Docker Hub

Running this tool as a docker container is the simplest method for getting started.

**Requirements:**
 - [Docker](https://www.docker.com/get-started)

**Install:**
```console
$ docker pull openmbee/confluence-mdk:latest
```

**Prepare:**
Create a file to store configuration and user credentials that the tool will use to connect to Confluence wiki (remove the `export` keywords from the [example environment variables file](#environment-variables)) and name the file `.docker.env`, then pass it into the docker run command like so:

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
 - Node.js >= v12.0.0

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

The CLI has several commands, most having subcommands:

```console
confluence-mdk <command>

Commands:
  cli.mjs wiki <subcommand>     Manipulate the Confluence Wiki
  cli.mjs s3 <subcommand>       Control a remote S3 Bucket
  cli.mjs neptune <subcommand>  Control a remote AWS Neptune triplestore
  cli.mjs import                Import an exported dataset into a Neptune databa
                                se (composition of `s3` and `neptune` commands a
                                bove)

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
```

### Environment Variables

For local testing, it is recommended that your create a `.env` file with all the environment variables (docker users skip this step):

For Linux and MacOS:
```bash
#!/bin/bash
export CONFLUENCE_SERVER=https://wiki.xyz.org

###############################
# user/pass
export CONFLUENCE_USER=user
export CONFLUENCE_PASS=pass

# OR, using a personal access token
export CONFLUENCE_TOKEN=<yourPersonalAccessToken>
###############################

export NEPTUNE_S3_BUCKET_URL=s3://my-bucket
export NEPTUNE_S3_IAM_ROLE_ARN=arn:aws-us-gov:iam::123456784201:role/NeptuneLoadFromS3

export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=AKIAZH1AZYX1BABA1AB2
export AWS_SECRET_ACCESS_KEY=hoijAF/sEcRetAcc3SsKeYz/sjoAFNOJo18SOjos

export SPARQL_ENDPOINT=https://my-sparql-endpoint.us-east-1.neptune.amazonaws.com:8182
export SPARQL_PROXY=socks5://127.0.0.1:3032
```

Then, simply `$ source .env` before running the CLI.

For Windows, use `set` instead of `export`, for example:
```powershell
set CONFLUENCE_SERVER=https://wiki.xyz.org

# user/pass
set CONFLUENCE_USER=user
set CONFLUENCE_PASS=pass

# OR, using a personal access token
set CONFLUENCE_TOKEN=<yourPersonalAccessToken>
```



### CLI: `wiki`

Use `confluence-mdk wiki --help` for the latest documentation about this command's options.


#### CLI: `wiki export`

Export the contents of the given page (and optionally all of its descdendents using the `--recurse` flag), as well as the wiki structure between them (i.e., the parent/child relationships).

Say we have a root wiki page at `https://wiki.xyz.org/display/somespace/PageTitle` on our server and we want to export it along with all of its descendents:
```console
$ confluence-mdk wiki export https://wiki.xyz.org/display/somespace/PageTitle --recurse > wiki-export.ttl
```

#### CLI: `wiki child-pages`

Print a line-delimited list (or as JSON array using `--json` flag) of URLs of the target's child pages.


### CLI: `s3`

Use `confluence-mdk s3 --help` for the latest documentation about this command's options.

This command provides some basic control over an S3 bucket for uploading RDF data from your local machine.

#### CLI: `s3 upload-data`

Uploads the Turtle file on stdin to the configured S3 bucket (overwriting the existing object).

Example:
```console
$ confluence-mdk s3 upload-data  \
    --prefix="confluence/rdf/"  \
    --graph="https://wiki.xyz.org/display/somespace/MainPage"  \
    https://wiki.xyz.org/display/somespace/MainPage  < wiki-export.ttl
```

#### CLI: `s3 upload-ontology`

Uploads the static (prebuilt) ontology to the configured S3 bucket (overwriting the existing object)


### CLI: `neptune`

Use `confluence-mdk neptune --help` for the latest documentation about this command's options.

This command provides some basic control over a Neptune instance for clearing a graph and then triggering Neptune's bulk loader on an S3 bucket.

#### CLI: `neptune clear`

Clear the given named graph.

Example:
```console
$ confluence-mdk neptune clear --graph="https://wiki.xyz.org/display/somespace/MainPage"
```

#### CLI: `neptune load`
Bulk loads the ontology and data from S3 into the given named graph.

Example:
```console
$ confluence-mdk neptune load --graph="https://wiki.xyz.org/display/somespace/MainPage" --bucket "s3://bucket-uri"
```


### CLI: `import`
This is simply a convenience command which is equivalent to calling the following commands in order (passing in all relevant options such as `--prefix` and `--graph`):
 1. `confluence-mdk s3 upload-data < {STDIN}`
 2. `confluence-mdk s3 upload-ontology`
 3. `confluence-mdk neptune clear`
 4. `confluence-mdk neptune load`

Outputs are logged to stdout.


#### `s3`, `neptune` and `import` Options:
 - `--prefix` -- string to prepend to the S3 objects, e.g., `my-folder/`
 - `--graph` -- IRI of the named graph to load all the RDF data into, e.g., `https://wiki.xyz.org/display/Space+Rocks`
 - `--region` -- AWS region of the S3 bucket and Neptune cluster (they must be in the same region). defaults to `AWS_REGION` env var otherwise
 - `--bucket` -- the AWS `s3://...` bucket URI. defaults to `NEPTUNE_S3_BUCKET_URL` env var otherwise
 - `--sparql-endpoint` -- the public URL to the SPARQL endpoint exposed by the Neptune cluster. defaults to `SPARQL_ENDPOINT` env var otherwise
 - `--neptune-s3-iam-role-arn` -- the ARN for an IAM role to be assumed by Neptune instance for access to S3 bucket. defaults to `NEPTUNE_S3_IAM_ROLE_ARN` env var otherwise

#### `s3`, `neptune` and `import` Environment variables:

 - ~`NEPTUNE_REGION` - the AWS region in which the Neptune cluster is located~ deprecated; use `AWS_REGION` instead
 - `AWS_REGION` - the AWS region in which the Neptune cluster is located
 - `NEPTUNE_S3_BUCKET_URL` - the `s3://...` bucket URL
 - `NEPTUNE_S3_IAM_ROLE_ARN` - the ARN associated with the Neptune cluster's role for loading data from S3
 - `AWS_ACCESS_KEY_ID`  - AWS access key id
 - `AWS_SECRET_ACCESS_KEY` - AWS secret access key
 - `SPARQL_ENDPOINT` - the public URL to the SPARQL endpoint exposed by the Neptune cluster
 - `SPARQL_PROXY` - optional URL to a proxy used for sending requests to SPARQL endpoint (requests must originate from a machine within same VPC as cluster, using proxy here allows you to send HTTP(S) requests thru ssh tunnel you open to ec2 machine)


----------------


### API: `wikiExport`

Fetch the metadata and contents of the given page as well as all of its children, then produce an RDF representation of that information serialized as Turtle.

`async function wikiExport(options: `[`ExportConfig`](#api-exportconfig)`) => Promise<void>`

Example:
```js
import {
  wikiExport,
} from 'confluence-mdk';

(async() => {
  await wikiExport({
    page: 'https://wiki.xyz.org/pages/viewpage.action?pageId=12345',
    user: process.env.CONFLUENCE_USER,
    pass: process.env.CONFLUENCE_PASS,
    output: fs.createWriteStream('./export.ttl'),
  });
})();
```

Or, if using commonjs:
```js
const {
  wikiExport,
} = require('confluence-mdk');
```


### API: `wikiChildPages`

Retrieve the child pages of the given Confluence page.

`async function wikiExport(options: `[`ExportConfig`](#api-exportconfig)`) => Promise<string[]>`



### API: `ExportConfig`
is defined by the interface:
 - `'page': string` - URI, `space/title`, or page id of the root page to export
 - `'server'?: string` - _optional_ URI origin of the Confluence server. can be ommitted if a URI is passed to `page`
 - `'token'?: string` - personal access token to use instead of user/pass. defaults to `CONFLUENCE_TOKEN` env var otherwise
 - `'user'?: string` - username to use for basic auth. defaults to `CONFLUENCE_USER` env var otherwise
 - `'pass'?: string` - password to use for basic auth. defaults to `CONFLUENCE_PASS` env var otherwise
 - `'output'?: stream.Writable` - _optional_ writable stream to output the RDF. defaults to stdout
 - `'recurse'?: boolean` - _optional_ whether or not to recursively export the children of this page. defaults to `false`



### API: `s3UploadData`

Uploads the given Turtle input stream to the configured S3 bucket (overwriting the existing `data.ttl` object).

`async function s3UploadData(options: `[`ImportConfig`](#api-importconfig)`) => Promise<void>`



### API: `s3UploadOntology`

Uploads the given Turtle input stream to the configured S3 bucket (overwriting the existing `ontology.ttl` object).

`async function s3UploadOntology(options: `[`ImportConfig`](#api-importconfig)`) => Promise<void>`



### API: `neptuneClear`

Clears the given named graph on the Neptune database.

`async function neptuneClear(options: `[`ImportConfig`](#api-importconfig)`) => Promise<SPARQLUpdateResponseData>`



### API: `neptuneLoad`

Loads all objects with the given S3 prefix into the given named graph on the Neptune database.

`async function neptuneLoad(options: `[`ImportConfig`](#api-importconfig)`) => Promise<BulkLoadResult>`



### API: `runImport`

Runs the above functions in order. All togetherm this will upload the given Turtle input stream along with the fixed ontology to the configured S3 bucket (overwriting existing objects), clear the given named graph, then bulk load the data from S3 into the given named graph.

`async function runImport(options: `[`ImportConfig`](#api-importconfig)`) => Promise<ImportResults>`

See [ImportConfig here](#api-importconfig).

Where `ImportResults` will be an object with the following format:
 - `'clear'` - demarshalled JSON response from issuing the SPARQL command that clears the triples in the named graph
 - `'load'` - demarshalled JSON response from the bulk upload command that loads data into the named graph from the S3 bucket


Example:
```js
import {
  runImport,
} from 'confluence-mdk';

(async() => {
  await runImport({
    prefix: 'confluence/rdf/',
    graph: 'https://wiki.xyz.org/display/wip/World+Domination',
    input: fs.createReadStream('./export.ttl'),
  });
})();
```

Or, if using commonjs:
```js
const {
  runImport,
} = require('confluence-mdk');
```


#### API: `ImportConfig`
is defined by the interface:
 - `'prefix': string` - S3 object key prefix, e.g., "confluence/rdf/" . in this example, notice the trailing slash to specify a folder; you can specify the full object instead e.g., "confluenc/rdf/data.ttl"
 - `'graph': string` - IRI of the named graph to contain the triples, best practice is to use URI of the Wiki "space". this named graph will be cleared before being populated with the ontology and data
 - `'input'?:  stream.Readable` - _optional_ readable stream to input the RDF data to be uploaded
 - `'region'?: string` - AWS region of the S3 bucket and Neptune cluster (they must be in the same region). defaults to `AWS_REGION` env var otherwise
 - `'bucket'?: string` - the AWS `s3://...` bucket URI. defaults to `NEPTUNE_S3_BUCKET_URL` env var otherwise
 - `'sparql_endpoint'?: string` - the public URL to the SPARQL endpoint exposed by the Neptune cluster. defaults to `SPARQL_ENDPOINT` env var otherwise
 - `'neptune_s3_iam_role_arn'?: string` - the ARN for an IAM role to be assumed by Neptune instance for access to S3 bucket. defaults to `NEPTUNE_S3_IAM_ROLE_ARN` env var otherwise
