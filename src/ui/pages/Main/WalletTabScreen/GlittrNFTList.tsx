import { Buffer } from 'buffer';
import { CID } from 'multiformats/cid';
import pako from 'pako';
import { useEffect, useState } from 'react';

import { CHAINS_MAP } from '@/shared/constant';
import { GlittrBalanceData } from '@/shared/types';
import { Column, Row } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { Empty } from '@/ui/components/Empty';
import { Pagination } from '@/ui/components/Pagination';
import { useExtensionIsInTab } from '@/ui/features/browser/tabs';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useChainType } from '@/ui/state/settings/hooks';
import { LoadingOutlined } from '@ant-design/icons';

import { useNavigate } from '../../MainRoute';

const isCID = (cid: string) => {
  try {
    CID.parse(cid);
    return true;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return false;
  }
};

type GlittrNFT = {
  id: string;
  amount: string;
  total_supply: string;
  asset: number[];
  restoredImage?: string;
};

export function GlittrNFTList() {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const chainType = useChainType();
  const tools = useTools();
  const isInTab = useExtensionIsInTab();

  const [balance, setBalance] = useState<GlittrBalanceData | null>(null);
  const [nfts, setNFTs] = useState<GlittrNFT[]>([]);
  const [total, setTotal] = useState(-1);
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 200 });

  const fetchData = async () => {
    try {
      const balanceData = await fetch(
        `${CHAINS_MAP[chainType].glittrApi}/helper/address/${currentAccount.address}/balance`
      );
      if (!balanceData.ok) {
        console.log(`Failed to fetch balance: ${balanceData.statusText}`);
        setNFTs([]);
        setTotal(0);
        return;
      }
      const _balance = await balanceData.json();
      if (!_balance) {
        throw new Error('Invalid balance data received');
      }

      // Filter only NFT assets (those with asset)
      const userNFTs = await Promise.all(
        Object.entries(_balance.balance.summarized)
          .filter(([key]) => {
            const contractInfo = _balance.contract_info[key];
            return contractInfo && contractInfo.type === undefined;
          })
          .map(async ([key, amount]) => {
            const contractInfo = _balance.contract_info[key];
            let restoredImage;
            if (isCID(Buffer.from(contractInfo.asset).toString())) {
              restoredImage = 'https://ipfs.io/ipfs/' + Buffer.from(contractInfo.asset).toString();
            } else {
              try {
                const restored = pako.inflate(Buffer.from(contractInfo.asset));
                restoredImage = `data:image/bmp;base64,${Buffer.from(restored).toString('base64')}`;
                console.log(restoredImage);
              } catch (e) {
                console.error(e);
                restoredImage = `data:image/bmp;base64,${Buffer.from(contractInfo.asset).toString('base64')}`;
                console.error(restoredImage);
              }
            }

            return {
              id: key,
              amount: amount as string,
              ...contractInfo,
              restoredImage
            };
          })
      );

      setBalance(_balance);
      setNFTs(userNFTs);
      setTotal(userNFTs.length);
    } catch (e) {
      setNFTs([]);
      setTotal(0);
      tools.toastError((e as Error).message);
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    return () => {
      // Cleanup object URLs when component unmounts
      nfts.forEach((nft) => {
        if (nft.restoredImage) {
          URL.revokeObjectURL(nft.restoredImage);
        }
      });
    };
  }, [pagination, currentAccount.address, chainType]);

  const containerStyle = {
    width: 'auto',
    height: isInTab ? 'calc(100vh - 240px)' : '500px',
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const
  };

  const itemStyle = {
    padding: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    marginBottom: '8px',
    width: 'calc(50% - 8px)', // Set width to 50% minus gap
    backgroundColor: '#2A2A2A',
    transition: 'all 0.2s ease',
    cursor: 'pointer'
  } as const;

  if (total === -1) {
    return (
      <Column style={{ ...containerStyle, minHeight: 150 }} itemsCenter justifyCenter>
        <LoadingOutlined />
      </Column>
    );
  }

  if (total === 0) {
    return (
      <Column style={{ minHeight: 150 }} itemsCenter justifyCenter>
        <Empty text="Empty" />
      </Column>
    );
  }

  return (
    <Column style={containerStyle}>
      <Row style={{ flexWrap: 'wrap', padding: '8px', gap: '16px' }}>
        {nfts.map((nft, index) => (
          <div
            key={index}
            className="glittr-item"
            style={itemStyle}
            onClick={() => {
              navigate('GlittrTokenScreen', { balance, id: nft.id });
            }}>
            <Row justifyBetween itemsCenter>
              <Column gap="sm" style={{ width: '100%' }}>
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    backgroundColor: '#444',
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '8px',
                    imageRendering: 'pixelated'
                  }}>
                  {nft.restoredImage ? (
                    <img
                      src={nft.restoredImage}
                      alt="NFT"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        borderRadius: '2px',
                        imageRendering: 'pixelated'
                      }}
                    />
                  ) : (
                    <span style={{ color: '#999' }}>NFT Image</span>
                  )}
                </div>
                <Row gap="sm" itemsCenter>
                  <span style={{ fontSize: '12px', color: '#999' }}>ID: {nft.id}</span>
                </Row>
                <Row gap="sm" style={{ flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#999' }}>Balance: {nft.amount}</span>
                  {isInTab && <span style={{ fontSize: '12px', color: '#666' }}>•</span>}
                  <span style={{ fontSize: '12px', color: '#999' }}>Total Supply: {nft.total_supply}</span>
                </Row>
              </Column>
            </Row>
          </div>
        ))}
      </Row>
      <Row justifyCenter mt="md" pb="md">
        <Pagination
          pagination={pagination}
          total={total}
          onChange={(pagination) => {
            setPagination(pagination);
          }}
        />
      </Row>
    </Column>
  );
}
