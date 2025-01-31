import { useEffect, useState } from 'react';

import { runesUtils } from '@/shared/lib/runes-utils';
import { Button, Column, Content, Header, Icon, Layout, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { BRC20Ticker } from '@/ui/components/BRC20Ticker';
import { Line } from '@/ui/components/Line';
import { Section } from '@/ui/components/Section';
import { TickUsdWithoutPrice, TokenType } from '@/ui/components/TickUsd';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import {
  useChainType,
  useUnisatWebsite
} from '@/ui/state/settings/hooks';
import { colors } from '@/ui/theme/colors';
import { fontSizes } from '@/ui/theme/font';
import { copyToClipboard, showLongNumber, useLocationState, useWallet } from '@/ui/utils';
import { LoadingOutlined } from '@ant-design/icons';

import { CHAINS_MAP } from '@/shared/constant';
import { useNavigate } from '../MainRoute';

interface LocationState {
  id: string;
}

interface ContractInfo {
  ticker: string;
  divisibility: number;
  supply_cap: string;
  total_supply: string;
  type: {
    free_mint: boolean;
  };
}

interface TokenData {
  id: string;
  amount: string;
  contractInfo: ContractInfo;
}

export default function GlittrTokenScreen() {
  const { id } = useLocationState<LocationState>();
  const wallet = useWallet();
  const account = useCurrentAccount();
  const navigate = useNavigate();
  const unisatWebsite = useUnisatWebsite();
  const tools = useTools();
  const chainType = useChainType();

  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData>();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const balanceData = await fetch(`${CHAINS_MAP[chainType].glittrApi}/helper/address/${account.address}/balance`);
        const balance = await balanceData.json();

        // Process contract info and balance data
        const contractInfo = balance.contract_info[id];
        const amount = balance.balance.summarized[id];

        if (contractInfo && amount) {
          setTokenData({
            id,
            amount,
            contractInfo
          });
        }

        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };

    fetchData();
  }, [id, account.address, chainType]);

  if (loading || !tokenData) {
    return (
      <Layout>
        <Content itemsCenter justifyCenter>
          <Icon size={fontSizes.xxxl} color="gold">
            <LoadingOutlined />
          </Icon>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
      />
      <Content>
        <Column py="xl" gap="lg" style={{ borderBottomWidth: 1, borderColor: colors.white_muted }}>
          <Row itemsCenter fullX justifyCenter gap="md">
            <Text
              text={`${runesUtils.toDecimalAmount(
                tokenData.amount,
                tokenData.contractInfo.divisibility
              )}`}
              preset="bold"
              textCenter
              size="xxl"
              wrap
              digital
            />
            <BRC20Ticker tick={tokenData.contractInfo.ticker} preset="lg" />
          </Row>

          <Row justifyCenter fullX>
            <Text
              text={id}
              preset="sub-bold"
              textCenter
              size="xs"
              onClick={() => {
                copyToClipboard(id).then(() => {
                  tools.toastSuccess('Copied');
                });
              }}
            />
          </Row>

          <Row justifyCenter fullX mb="lg">
            <TickUsdWithoutPrice
              tick={tokenData.id}
              balance={runesUtils.toDecimalAmount(
                tokenData.amount,
                tokenData.contractInfo.divisibility
              )}
              type={TokenType.RUNES}
              size={'md'}
            />
          </Row>

          <Row justifyBetween gap="lg" px="lg">
            <Button
              text="Send"
              preset="home"
              icon="send"
              onClick={(e) => {
                navigate('SendGlittrScreen', {
                  id: tokenData.id,
                  amount: tokenData.amount,
                  contractInfo: tokenData.contractInfo
                });
              }}
              full
            />
            <Button
              text="Burn"
              preset="home"
              icon="burn"
              onClick={(e) => {
                // TODO: Implement send functionality
              }}
              full
            />
          </Row>
        </Column>

        <Column
          gap="xl"
          px="xl"
          py="xl"
          mt="lg"
          style={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: 15
          }}>

          <Section
            title="Minted Supply"
            value={`${showLongNumber(
              runesUtils.toDecimalAmount(tokenData.contractInfo.total_supply, tokenData.contractInfo.divisibility)
            )} ${tokenData.contractInfo.ticker}`}
          />
          <Line />

          <Section
            title="Supply Cap"
            value={`${showLongNumber(
              runesUtils.toDecimalAmount(tokenData.contractInfo.supply_cap, tokenData.contractInfo.divisibility)
            )} ${tokenData.contractInfo.ticker}`}
          />
          <Line />

          <Section title="Divisibility" value={tokenData.contractInfo.divisibility} />
          <Line />

          <Section title="Ticker" value={tokenData.contractInfo.ticker} />
          <Line />

          <Section title="Free Mint" value={tokenData.contractInfo.type.free_mint ? "Yes" : "No"} />
        </Column>

      </Content>
    </Layout>
  );
}
