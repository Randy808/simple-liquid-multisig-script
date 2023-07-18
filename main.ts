import * as liquid from "liquidjs-lib";
let ecc = require("tiny-secp256k1");
import {
  spendFromMultisig,
  spendToAddress as spendToAddress,
  SendResult,
} from "./liquidjs-helper";
import {
  INTERNAL_PUBLIC_KEY,
  LBTC_ASSET_ID,
  NETWORK,
  TRANSACTION_FEE_IN_SATOSHIS,
} from "./constants";
import { createInput } from "./utils";
import KeypairManager from "./KeypairManager";

function getMultisigScript(publicKeys: string[], threshold: number): Buffer {
  if (threshold == null || threshold == undefined) {
    throw new Error("Threshold must be specified");
  }

  let serializedThreshold;

  if (threshold <= 16) {
   serializedThreshold = `OP_${threshold}`;
  }
  else {
    serializedThreshold = threshold.toString(16).padStart(2, '0');
  }

  let leafScriptAsm = ``;

  //OP_CHECKSIGADD has not been added to liquidjs so I put the equivalent opcodes defined in Rationale 4 of BIP341 (https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki)
  const OP_CHECKSIGADD = `OP_ROT OP_SWAP OP_CHECKSIG OP_ADD`;

  for (let p of publicKeys) {
    if (!leafScriptAsm) {
      leafScriptAsm += `${p.toLowerCase()} OP_CHECKSIG`;
    } else {
      leafScriptAsm += ` ${p.toLowerCase()} ${OP_CHECKSIGADD}`;
    }
  }

  leafScriptAsm += ` ${serializedThreshold} OP_GREATERTHANOREQUAL`;
  return liquid.script.fromASM(leafScriptAsm);
}

export function getTaprootAddress(
  internalPublicKey: Buffer,
  leafScript: Buffer
): string {
  let leaves = [
    {
      scriptHex: leafScript.toString("hex"),
    },
  ];

  let hashTree = liquid.bip341.toHashTree(leaves);
  let bip341Factory = liquid.bip341.BIP341Factory(ecc);
  let output = bip341Factory.taprootOutputScript(internalPublicKey, hashTree);
  let p2trAddress = liquid.address.fromOutputScript(output, NETWORK);

  if (!p2trAddress) {
    throw new Error("Taproot address could not be derived");
  }

  return p2trAddress;
}

async function main() {
  // Feel free to change these
  const NUMBER_OF_KEYPAIRS = 100;
  //Must be below 16
  const THRESHOLD_FOR_SIGNERS = 99;
  const TEST_AMOUNT = 10000;

  /************************/

  console.log("Generating keypairs...");

  let keypairManager =
    KeypairManager.initializeWithRandomKeys(NUMBER_OF_KEYPAIRS);
  let publicKeys: string[] = keypairManager.getSortedPublicKeys();

  /************************/

  console.log(
    "Constructing a multisig address from the following public keys:"
  );
  for (let publicKey of publicKeys) {
    console.log(publicKey);
  }

  let multisigScript = getMultisigScript(publicKeys, THRESHOLD_FOR_SIGNERS);
  let multisigAddress = getTaprootAddress(INTERNAL_PUBLIC_KEY, multisigScript);

  /************************/

  console.log(`Sending funds to the multisig address ${multisigAddress}`)

  let multisigFundingResult: SendResult = await spendToAddress({
    assetId: LBTC_ASSET_ID,
    address: multisigAddress!,
    amount: TEST_AMOUNT,
  });

  console.log("Funding tx id:", multisigFundingResult.tx.txid);

  /************************/

  console.log("Constructing transaction to send multisig-locked utxo...");

  let inputs: any = [];
  inputs.push(createInput(multisigFundingResult));

  let outputs = [
    new liquid.PsetOutput(
      TEST_AMOUNT - TRANSACTION_FEE_IN_SATOSHIS,
      Buffer.from(LBTC_ASSET_ID, "hex").reverse(),
      liquid.address.toOutputScript(multisigAddress)
    ),
    new liquid.PsetOutput(
      TRANSACTION_FEE_IN_SATOSHIS,
      Buffer.from(LBTC_ASSET_ID, "hex").reverse(),
      Buffer.alloc(0)
    ),
  ];

  let mulitsigSpend = await spendFromMultisig({
    keypairManager,
    inputs,
    outputs,
    internalPublicKey: INTERNAL_PUBLIC_KEY,
    multisigScript,
  });
}

main();
