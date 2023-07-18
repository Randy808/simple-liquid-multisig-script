import {
  Extractor,
  Pset,
  PsetGlobal,
  Transaction,
  witnessStackToScriptWitness,
} from "liquidjs-lib";
import * as liquid from "liquidjs-lib";
let ecc = require("tiny-secp256k1");
import { LBTC_ASSET_ID, NETWORK } from "./constants";
import ElementsClient from "./elements-client";
import {
  SimplifiedVerboseGetRawTransactionResponse,
} from "./elements-client/module";
export interface SendResult {
  tx: SimplifiedVerboseGetRawTransactionResponse;
  outputIndex: number;
}

const elementsClient = new ElementsClient();

let getOutputForAssetId = (tx, assetId: string) => {
  let { vout } = tx;

  for (let i = 0; i < vout.length; i++) {
    if (vout[i].asset == assetId && vout[i].scriptPubKey.asm) {
      return i;
    }
  }

  return -1;
};

function convertToBitcoinUnits(amount) {
  return amount / 100_000_000;
}

export async function spendToAddress({
  assetId,
  address,
  amount: amountInSatoshis,
}: {
  assetId: string;
  address: string;
  amount: number;
}): Promise<SendResult> {
  let sendToAddressTxId = await elementsClient.sendToAddress(
    address,
    convertToBitcoinUnits(amountInSatoshis),
    assetId
  );
  let tx = await elementsClient.getRawTransaction(sendToAddressTxId);
  let outputIndex = getOutputForAssetId(tx, assetId);

  return {
    tx,
    outputIndex,
  };
}

export function toXOnly(key: Buffer) {
  return key.subarray(1);
}

export function spendFromMultisig({
  keypairManager,
  inputs,
  outputs,
  internalPublicKey,
  multisigScript,
}: {
  keypairManager: any;
  inputs: any[];
  outputs: any[];
  internalPublicKey;
  multisigScript;
}) {
  const TRANSACTION_VERSION = 2;

  let pset = new Pset(
    new PsetGlobal(TRANSACTION_VERSION, inputs.length, outputs.length),
    inputs,
    outputs
  );

  let leaves = [
    {
      scriptHex: multisigScript.toString("hex"),
    },
  ];

  let leafHash = liquid.bip341.tapLeafHash(leaves[0]);
  let hashTree = liquid.bip341.toHashTree(leaves);
  const bip341Factory = liquid.bip341.BIP341Factory(ecc);

  // Path will always be '[]' since we only have one script in tree
  let path = liquid.bip341.findScriptPath(hashTree, leafHash);
  let taprootStack = bip341Factory.taprootSignScriptStack(
    internalPublicKey,
    leaves[0],
    hashTree.hash,
    path
  );

  const preimage = pset.getInputPreimage(
    0,
    Transaction.SIGHASH_ALL,
    NETWORK.genesisBlockHash,
    leafHash
  );

  let signatures: any[] = [];

  const serializeSchnnorrSig = (sig: Buffer, hashtype: number) =>
    Buffer.concat([
      sig,
      hashtype !== 0x00 ? Buffer.of(hashtype) : Buffer.alloc(0),
    ]);

  for (let keypair of keypairManager.getKeypairsSortedByPublicKey().reverse()) {
    let signature = ecc.signSchnorr(
      preimage,
      keypair.privateKey,
      Buffer.alloc(32)
    );

    signatures.push(
      serializeSchnnorrSig(Buffer.from(signature), Transaction.SIGHASH_ALL)
    );
  }

  pset.inputs[0].finalScriptWitness = witnessStackToScriptWitness([
    ...signatures,
    ...taprootStack,
  ]);

  const tx = Extractor.extract(pset);
  const hex = tx.toHex();
  return broadcastTx(hex, LBTC_ASSET_ID);
}

export async function broadcastTx(
  tx: string,
  assetId: string
): Promise<SendResult> {
  try {
    let txid: string = await elementsClient
      .getRawClient()
      .request("sendrawtransaction", {
        hexstring: tx,
      });

    console.log(`Successfully broadcast transaction: ${txid}\n\n`);

    try {
      let address = await elementsClient
        .getRawClient()
        .request("getnewaddress");

      await elementsClient.getRawClient().request("generatetoaddress", {
        address: address,
        nblocks: 10,
      });
    } catch (err) {
      console.log("Error generating blocks");
    }

    let verboseGetRawTransactionResponse =
      await elementsClient.getRawTransaction(txid);
    let outputIndex = getOutputForAssetId(
      verboseGetRawTransactionResponse,
      assetId
    );

    return {
      tx: verboseGetRawTransactionResponse,
      outputIndex,
    };
  } catch (err) {
    console.log("\n\n", (err as any).message, "\n\n");
    return Promise.reject();
  }
}
