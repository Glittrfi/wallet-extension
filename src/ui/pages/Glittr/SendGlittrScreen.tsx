import { useEffect, useMemo, useState } from 'react';

import { CHAINS_MAP } from '@/shared/constant';
import { runesUtils } from '@/shared/lib/runes-utils';
import { NetworkType, RawTxInfo } from '@/shared/types';
import { Button, Column, Content, Header, Input, Layout, Row, Text } from '@/ui/components';
import { FeeRateBar } from '@/ui/components/FeeRateBar';
import { OutputValueBar } from '@/ui/components/OutputValueBar';
import { TickUsdWithoutPrice, TokenType } from '@/ui/components/TickUsd';
import { useNavigate } from '@/ui/pages/MainRoute';
import { useCurrentAccount } from '@/ui/state/accounts/hooks';
import { useChainType } from '@/ui/state/settings/hooks';
import { colors } from '@/ui/theme/colors';
import { isValidAddress, showLongNumber, useLocationState, useWallet } from '@/ui/utils';
import { addFeeToTx, BitcoinUTXO, BlockTxTuple, electrumFetchNonGlittrUtxos, encodeVaruint, getAssetUtxos, GlittrSDK, Network, OpReturnMessage, Output, txBuilder, Varuint } from '@glittr-sdk/sdk';
import { ToSignInput } from '@unisat/wallet-sdk';
import { bitcoin } from '@unisat/wallet-sdk/lib/bitcoin-core';
import { getAddressUtxoDust } from '@unisat/wallet-sdk/lib/transaction';

interface ContractInfo {
  ticker: string;
  divisibility: number;
  supply_cap: string;
  total_supply: string;
  type: {
    free_mint: boolean;
  };
}

interface LocationState {
  id: string;
  amount: string;
  contractInfo: ContractInfo;
}

type TransferParams = {
  contractId: string;
  amount: string;
  receiver: string;
}


export default function SendGlittrScreen() {
  const defaultOutputValue = 546;
  const { id, amount, contractInfo } = useLocationState<LocationState>();

  const wallet = useWallet();
  const chainType = useChainType();
  const account = useCurrentAccount()

  const navigate = useNavigate();
  const [inputAmount, setInputAmount] = useState('');
  const [disabled, setDisabled] = useState(true);
  const [toInfo, setToInfo] = useState<{
    address: string;
    domain: string;
  }>({
    address: '',
    domain: ''
  });
  const [outputValue, setOutputValue] = useState(defaultOutputValue);
  const [availableBalance, setAvailableBalance] = useState(amount);
  const [error, setError] = useState('');

  const currentAccount = useCurrentAccount();
  const minOutputValue = useMemo(() => {
    if (toInfo.address) {
      const dust1 = getAddressUtxoDust(currentAccount.address);
      const dust2 = getAddressUtxoDust(toInfo.address);
      return Math.max(dust1, dust2);
    } else {
      return 0;
    }
  }, [toInfo.address, currentAccount.address]);

  const [feeRate, setFeeRate] = useState(5);

  const [rawTxInfo, setRawTxInfo] = useState<RawTxInfo>();
  useEffect(() => {
    setError('');
    setDisabled(true);

    if (!isValidAddress(toInfo.address)) {
      return;
    }
    if (!inputAmount) {
      return;
    }
    if (feeRate <= 0) {
      return;
    }
    if (outputValue < minOutputValue) {
      setError(`OutputValue must be at least ${minOutputValue}`);
      return;
    }
    if (!outputValue) {
      return;
    }

    const glittrTransfer = async (): Promise<RawTxInfo> => {
      const transfers: TransferParams[] = [{
        amount: inputAmount,
        contractId: id,
        receiver: toInfo.address
      }]

      const walletNetwork = await wallet.getNetworkType()
      let network: Network = "testnet" //default
      if (walletNetwork === NetworkType.MAINNET) {
        network = 'mainnet'
      } else if (walletNetwork === NetworkType.TESTNET) {
        network = 'testnet'
      } else {
        network = 'regtest'
      }

      const glittrSdk = new GlittrSDK({
        network,
        glittrApi: CHAINS_MAP[chainType].glittrApi,
        electrumApi: CHAINS_MAP[chainType].electrumApi,
        apiKey: CHAINS_MAP[chainType].glittrApiKey
      })
      const allTransfers: { amount: Varuint, asset: BlockTxTuple, output: Varuint }[] = [];
      const excessOutputs: { address: string, value: number }[] = [];

      allTransfers.push({
        amount: encodeVaruint(inputAmount),
        asset: [encodeVaruint(id.split(":")[0]!), encodeVaruint(id.split(":")[1]!)],
        output: encodeVaruint(1)
      })

      const utxos = await electrumFetchNonGlittrUtxos(glittrSdk, account.address)
      const nonFeeInputs: BitcoinUTXO[] = []

      for (const transfer of transfers) {
        const assetRequired = BigInt(transfer.amount)
        const assetUtxos = await getAssetUtxos(glittrSdk, account.address, transfer.contractId)
        let assetTotal = BigInt(0)

        for (const utxo of assetUtxos) {
          if (assetTotal >= assetRequired) break
          assetTotal += BigInt(utxo.assetAmount)
          nonFeeInputs.push({
            txid: utxo.txid,
            vout: utxo.vout,
            value: utxo.value,
            status: utxo.status
          })
        }

        if (assetTotal < assetRequired) {
          throw new Error(`Insufficient balance for asset ${transfer.contractId}. Required: ${assetRequired}, balance: ${assetTotal}`)
        }

        const excessAssetValue = assetTotal - assetRequired
        if (excessAssetValue > 0) {
          // Add excess transfer to allTransfers array
          allTransfers.push({
            asset: [encodeVaruint(transfer.contractId.split(":")[0]!), encodeVaruint(transfer.contractId.split(":")[1]!)],
            amount: encodeVaruint(excessAssetValue),
            output: encodeVaruint(transfers.length + excessOutputs.length + 1)
          });
          // Add excess asset output to sender
          excessOutputs.push({
            address: account.address,
            value: 600
          });
        }
      }

      const tx: OpReturnMessage = {
        transfer: {
          transfers: allTransfers
        }
      };

      const nonFeeOutputs: Output[] = [
        { script: await txBuilder.compress(tx), value: 0 },
        ...transfers.map(t => ({
          address: t.receiver,
          value: 600
        })),
        ...excessOutputs
      ];

      const { inputs, outputs } = await addFeeToTx(
        network,
        account.address,
        utxos,
        nonFeeInputs,
        nonFeeOutputs
      )

      const psbt = await glittrSdk.createRawTx({
        address: account.address,
        inputs,
        outputs,
        publicKey: account.pubkey
      })

      // TODO validate glittr tx

      const toSignInputs: ToSignInput[] = await wallet.formatOptionsToSignInputs(psbt.toHex())
      const psbtHex = await wallet.signPsbtWithHex(psbt.toHex(), toSignInputs, true)
      const rawTx = bitcoin.Psbt.fromHex(psbtHex).extractTransaction().toHex()

      const rawTxInfo: RawTxInfo = {
        psbtHex,
        rawtx: rawTx,
        toAddressInfo: toInfo
      }

      return rawTxInfo
    }

    glittrTransfer().then((data) => {
      setRawTxInfo(data)
      setDisabled(false)
    }).catch((e) => {
      console.log(e)
      setError(e ?? e.message)
    })
  }, [toInfo, inputAmount, feeRate, outputValue, minOutputValue]);
  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title="Send Glittr Assets"
      />
      <Content>
        <Row justifyCenter>
          <Text
            text={`${showLongNumber(runesUtils.toDecimalAmount(amount, contractInfo.divisibility))} ${contractInfo.ticker
              }`}
            preset="bold"
            textCenter
            size="xxl"
            wrap
          />
        </Row>
        <Row justifyCenter fullX style={{ marginTop: -12, marginBottom: -12 }}>
          <TickUsdWithoutPrice
            tick={contractInfo.ticker}
            balance={runesUtils.toDecimalAmount(amount, contractInfo.divisibility)}
            type={TokenType.RUNES}
            size={'md'}
          />
        </Row>

        <Column mt="lg">
          <Text text="Recipient" preset="regular" color="textDim" />
          <Input
            preset="address"
            addressInputData={toInfo}
            onAddressInputChange={(val) => {
              setToInfo(val);
            }}
            autoFocus={true}
          />
        </Column>

        <Column mt="lg">
          <Row justifyBetween>
            <Text text="Balance" color="textDim" />
            <TickUsdWithoutPrice tick={contractInfo.ticker} balance={inputAmount} type={TokenType.RUNES} />
            <Row
              itemsCenter
              onClick={() => {
                setInputAmount(runesUtils.toDecimalAmount(availableBalance, contractInfo.divisibility));
              }}>
              <Text text="MAX" preset="sub" style={{ color: colors.white_muted }} />
              <Text
                text={`${showLongNumber(runesUtils.toDecimalAmount(availableBalance, contractInfo.divisibility))} ${contractInfo.ticker
                  }`}
                preset="bold"
                size="sm"
                wrap
              />
            </Row>
          </Row>
          <Input
            preset="amount"
            placeholder={'Amount'}
            value={inputAmount.toString()}
            onAmountInputChange={(amount) => {
              setInputAmount(amount);
            }}
            runesDecimal={contractInfo.divisibility}
          />
        </Column>

        {toInfo.address ? (
          <Column mt="lg">
            <Text text="OutputValue" color="textDim" />

            <OutputValueBar
              defaultValue={defaultOutputValue}
              minValue={minOutputValue}
              onChange={(val) => {
                setOutputValue(val);
              }}
            />
          </Column>
        ) : null}

        <Column mt="lg">
          <Text text="Fee" color="textDim" />

          <FeeRateBar
            onChange={(val) => {
              setFeeRate(val);
            }}
          />
        </Column>

        {error && <Text text={error} color="error" />}

        <Button
          disabled={disabled}
          preset="primary"
          text="Next"
          onClick={(e) => {
            navigate('GlittrTxConfirmScreen', { rawTxInfo });
          }}></Button>
      </Content>
    </Layout>
  );
}
