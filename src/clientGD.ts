import * as clientNeyra from 'client-neyra';
import * as clientGD from 'client-gd';
import { ethers } from 'ethers';
import { loadCreds } from './utils';

export { clientGD };

export const initClientGD = async ({ workspaceId }: { workspaceId?: number } = {}) => {
  const creds = await loadCreds();

  clientNeyra.initializeApiClient({
      baseURL: `${process.env.NEYRA_ENDPOINT}/api`,
      frontend: 'web',
      frontendVersion: '1.0.0',
  })

  const wallet = ethers.Wallet.fromPhrase(creds.mnemonic);
  const message = 'Welcome to Neyra Network. Your ID for this signature request is';
  const signature = await wallet.signMessage(message);
  const { data: { access_token } } = await clientNeyra.connectUser({ body: { 
      signature,
      provider: clientNeyra.AuthProvider.WalletConnect,
      publicAddress: wallet.address as `0x${string}`
  }});

  clientGD.initializeApiClient({
      frontend: 'web',
      frontendVersion: '1.0.0',
      baseURL: `${process.env.GD_ENDPOINT}/api`,
      headers: {
          'X-Token': `Bearer ${access_token}`
      }
  })

  if (workspaceId) {
      await clientGD.switchWorkspace({ 
          params: { workspaceId: Number(workspaceId) }
      })
  }
}