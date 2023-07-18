import { ECPairFactory, ECPairInterface } from "ecpair";
import { toXOnly } from "./liquidjs-helper";
let ecc = require("tiny-secp256k1");
let ECPair = ECPairFactory(ecc);

export default class KeypairManager {
  keypairs: ECPairInterface[];

  constructor(keypairs: ECPairInterface[]) {
    this.keypairs = keypairs;
  }
  
  private static getRandomKeypair(): ECPairInterface{
    return ECPair.makeRandom();
  }

  static initializeWithRandomKeys(numberOfKeypairs: number): KeypairManager {
    let keypairs: ECPairInterface[] = [];
    for(let i = 0 ; i < numberOfKeypairs ; i++){
      keypairs.push(KeypairManager.getRandomKeypair());
    }

    return new KeypairManager(keypairs);
  }

  // static initializeWithStandardInput(): KeypairManager {
  //     let keypairs: ECPairInterface[] = [];
  //     console.log(
  //       "Please enter the private keys you'd like to use separated by line breaks:"
  //     );
    
  //     let privateKey;
    
  //     while (privateKey != "\n") {
  //       privateKey = readLine();
  //       let privateKeyBuffer = Buffer.from(privateKey, "hex");
  //       let keypair = ECPair.fromPrivateKey(privateKeyBuffer);
  //       keypairs.push(keypair);
  //     }

  //     return new KeypairManager(keypairs);
  // }

  getSortedPublicKeys(): string[] {
    return this.keypairs.map(k => toXOnly(k.publicKey).toString("hex")).sort();
  }

  getKeypairsSortedByPublicKey() {
    return this.keypairs.sort((a, b) => (toXOnly(a.publicKey).toString("hex") > toXOnly(b.publicKey).toString("hex")) ? 1 : -1);
  }
}