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

type GlittrAsset = {
  id: string;
  ticker: string;
  amount: string;
  divisibility: number;
  supply_cap: string;
  total_supply: string;
  type: {
    free_mint: boolean;
  };
};

export function GlittrFTList() {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const chainType = useChainType();
  const tools = useTools();
  const isInTab = useExtensionIsInTab();

  const [balance, setBalance] = useState<GlittrBalanceData | null>(null);
  const [tokens, setTokens] = useState<GlittrAsset[]>([]);
  const [total, setTotal] = useState(-1);
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 200 });

  const fetchData = async () => {
    try {
      const balanceData = await fetch(
        `${CHAINS_MAP[chainType].glittrApi}/helper/address/${currentAccount.address}/balance`
      );
      if (!balanceData.ok) {
        console.log(`Failed to fetch balance: ${balanceData.statusText}`);
        setTokens([]);
        setTotal(0);
        return;
      }
      const _balance = await balanceData.json();
      if (!_balance) {
        throw new Error('Invalid balance data received');
      }

      // Filter only FT assets (those with contract_info containing divisibility, ticker, type)
      const userAssets = Object.entries(_balance.balance.summarized)
        .filter(([key]) => {
          const contractInfo = _balance.contract_info[key];
          return (
            contractInfo &&
            contractInfo.divisibility !== undefined &&
            contractInfo.type !== undefined &&
            !contractInfo.asset
          );
        })
        .map(([key, amount]) => ({
          id: key,
          ticker: _balance.contract_info[key].ticker,
          amount: amount as string,
          ..._balance.contract_info[key]
        }));

      setBalance(_balance);
      setTokens(userAssets);
      setTotal(userAssets.length);
    } catch (e) {
      setTokens([]);
      setTotal(0);
      tools.toastError((e as Error).message);
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
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
    width: '100%',
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
      <Row style={{ flexWrap: 'wrap', padding: '8px' }} gap="sm">
        {tokens.map((asset, index) => (
          <div
            key={index}
            className="glittr-item"
            style={itemStyle}
            onClick={() => {
              navigate('GlittrTokenScreen', { balance, id: asset.id });
            }}>
            <Row justifyBetween itemsCenter>
              <Column gap="sm">
                <Row gap="md" itemsCenter>
                  {asset.ticker && <strong style={{ fontSize: '14px', color: '#fff' }}>{asset.ticker}</strong>}
                  <span style={{ fontSize: '12px', color: '#999' }}>ID: {asset.id}</span>
                </Row>
                <Row gap="md" style={{ flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#999' }}>Balance: {asset.amount}</span>
                  <span style={{ fontSize: '12px', color: '#666' }}>•</span>
                  <span style={{ fontSize: '12px', color: '#999' }}>Cap: {asset.supply_cap}</span>
                </Row>
              </Column>
              <span
                style={{
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  backgroundColor: asset.type.free_mint ? '#2E4537' : '#453535',
                  color: asset.type.free_mint ? '#4CAF50' : '#EF5350'
                }}>
                {asset.type.free_mint ? 'Free Mint' : 'Paid Mint'}
              </span>
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
