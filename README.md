# simple-liquid-multisig-script

A simple example of how to construct and spend from a multisig taproot address on the Liquid Network.

## Prerequisites
- An elements node running on regtest
- Installation of npm
- Installation of typescript

## How to run
<ol>
<li>Make sure you have an elements node running (use <a href="https://github.com/vulpemventures/nigiri">nigiri</a> to run the script as-is)</li>

<li>Change admin1, 123, and 18881 in the string http://admin1:123@localhost:18881 from ElementsClient.ts to your username, password, and port respectively

<li>Open terminal</li>

<li><code>cd</code> to the folder containing the contents of this repo</li>

<li>Run <code>npm install</code></li>

<li>Run <code>ts-node main.ts</code></li>

<li>If the script is successful, the last log should should read <code>Successfully broadcast transaction:</code> followed by the id of the transaction spending from the multisig</li>
</ol>