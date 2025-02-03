import pako from 'pako';
import { useEffect, useState } from 'react';

import { runesUtils } from '@/shared/lib/runes-utils';
import { GlittrBalanceData, GlittrContractInfo } from '@/shared/types';
import { Button, Column, Content, Header, Icon, Layout, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { BRC20Ticker } from '@/ui/components/BRC20Ticker';
import { Line } from '@/ui/components/Line';
import { Section } from '@/ui/components/Section';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useChainType } from '@/ui/state/settings/hooks';
import { colors } from '@/ui/theme/colors';
import { fontSizes } from '@/ui/theme/font';
import { copyToClipboard, showLongNumber, useLocationState } from '@/ui/utils';
import { LoadingOutlined } from '@ant-design/icons';

import { useNavigate } from '../MainRoute';

interface LocationState {
  balance: GlittrBalanceData;
  id: string;
}

interface TokenData {
  id: string;
  amount: string;
  contractInfo: GlittrContractInfo;
}

export default function GlittrTokenScreen() {
  const { balance, id } = useLocationState<LocationState>();
  const account = useCurrentAccount();
  const navigate = useNavigate();
  const tools = useTools();
  const chainType = useChainType();

  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData>();

  useEffect(() => {
    const fetchData = async () => {
      try {
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
            {tokenData.contractInfo.type === undefined ? (
              <div
                style={{
                  width: '200px',
                  height: '200px',
                  backgroundColor: '#444',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  imageRendering: 'pixelated'
                }}>
                {tokenData.contractInfo.asset &&
                  (() => {
                    let restoredImage;
                    try {
                      const restored = pako.inflate(Buffer.from(tokenData.contractInfo.asset));
                      restoredImage = `data:image/bmp;base64,${Buffer.from(restored).toString('base64')}`;
                      console.log(restoredImage);
                    } catch (e) {
                      console.error(e);
                      restoredImage = `data:image/bmp;base64,${Buffer.from(tokenData.contractInfo.asset).toString(
                        'base64'
                      )}`;
                      console.error(restoredImage);
                    }
                    return (
                      <img
                        src={restoredImage}
                        alt="NFT"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          borderRadius: '2px',
                          imageRendering: 'pixelated'
                        }}
                      />
                    );
                  })()}
              </div>
            ) : (
              <>
                <Text text={tokenData.amount} preset="bold" textCenter size="xxl" wrap digital />
                <BRC20Ticker tick={tokenData.contractInfo.ticker} preset="lg" />
              </>
            )}
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
          {tokenData.contractInfo.type === undefined ? (
            <>
              <Section
                title="Minted Supply"
                value={`${showLongNumber(runesUtils.toDecimalAmount(tokenData.contractInfo.total_supply, 0))}`}
              />
              <Line />
              <Section
                title="Supply Cap"
                value={`${
                  tokenData.contractInfo.supply_cap
                    ? showLongNumber(runesUtils.toDecimalAmount(tokenData.contractInfo.supply_cap || '0', 0))
                    : '-'
                }`}
              />
            </>
          ) : (
            <>
              <Section
                title="Minted Supply"
                value={`${showLongNumber(runesUtils.toDecimalAmount(tokenData.contractInfo.total_supply, 0))} ${
                  tokenData.contractInfo.ticker
                }`}
              />
              <Line />
              <Section
                title="Supply Cap"
                value={`${showLongNumber(runesUtils.toDecimalAmount(tokenData.contractInfo.supply_cap || '0', 0))} ${
                  tokenData.contractInfo.ticker
                }`}
              />
              <Line />
              <Section title="Divisibility" value={tokenData.contractInfo.divisibility} />
              <Line />
              <Section title="Ticker" value={tokenData.contractInfo.ticker || ''} />
              <Line />
              <Section title="Free Mint" value={tokenData.contractInfo.type.free_mint ? 'Yes' : 'No'} />
            </>
          )}
        </Column>
      </Content>
    </Layout>
  );
}
