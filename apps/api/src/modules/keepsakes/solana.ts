import { create } from '@metaplex-foundation/mpl-core';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { generateSigner, keypairIdentity } from '@metaplex-foundation/umi';
import { base58 } from '@metaplex-foundation/umi/serializers';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { env } from '../../lib/env';

export type MintInput = {
  name: string;
  uri: string;
  attributes: { key: string; value: string }[];
};

export type MintResult = { mintAddress: string; txSignature: string };
export type MintFn = (input: MintInput) => Promise<MintResult>;

/** Request devnet SOL when the vault cannot pay a Core create. No-op when already funded. */
async function ensureVaultFunded(pubkey: string) {
  const conn = new Connection(env.SOLANA_RPC_URL, 'confirmed');
  const owner = new PublicKey(pubkey);
  const balance = await conn.getBalance(owner);
  if (balance >= 0.05 * LAMPORTS_PER_SOL) return;
  const signature = await conn.requestAirdrop(owner, LAMPORTS_PER_SOL);
  const blockhash = await conn.getLatestBlockhash('confirmed');
  await conn.confirmTransaction({ signature, ...blockhash }, 'confirmed');
}

/**
 * Mint one Metaplex Core asset on devnet to the server-held vault (section 8.15).
 * `SOLANA_VAULT_SECRET` is the base58 64-byte secret from `solana-keygen`.
 */
export async function mintOnDevnet(input: MintInput): Promise<MintResult> {
  if (!env.SOLANA_VAULT_SECRET) throw new Error('SOLANA_VAULT_SECRET is not set');
  const umi = createUmi(env.SOLANA_RPC_URL);
  const secret = base58.serialize(env.SOLANA_VAULT_SECRET);
  const vault = umi.eddsa.createKeypairFromSecretKey(secret);
  umi.use(keypairIdentity(vault));
  await ensureVaultFunded(vault.publicKey);
  const asset = generateSigner(umi);
  const tx = await create(umi, {
    asset,
    name: input.name.slice(0, 32),
    uri: input.uri,
    plugins: input.attributes.length ? [{ type: 'Attributes', attributeList: input.attributes }] : undefined,
  }).sendAndConfirm(umi);
  const [txSignature] = base58.deserialize(tx.signature);
  return { mintAddress: asset.publicKey, txSignature };
}
