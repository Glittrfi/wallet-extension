import { useEffect, useState } from 'react';

import { CHAIN_GROUPS, CHAINS_MAP, ChainType, TypeChainGroup } from '@/shared/constant';
import { Button, Card, Column, Icon, Image, Input, Row, Text } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { BottomModal } from '@/ui/components/BottomModal';
import { useReloadAccounts } from '@/ui/state/accounts/hooks';
import { useChain, useChangeChainTypeCallback, useGlittrApiKey, useSetGlittrApiKey } from '@/ui/state/settings/hooks';
import { colors } from '@/ui/theme/colors';
import { CloseOutlined } from '@ant-design/icons';

function ChainItem(props: { chainType: ChainType; inGroup?: boolean; onClose: () => void }) {
  const chain = CHAINS_MAP[props.chainType];
  const currentChain = useChain();
  const selected = currentChain.enum == chain.enum;
  const changeChainType = useChangeChainTypeCallback();
  const reloadAccounts = useReloadAccounts();
  const tools = useTools();
  const setGlittrApiKey = useSetGlittrApiKey();
  const glittrApiKey = useGlittrApiKey()

  const [apiKey, setApiKey] = useState(glittrApiKey);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleChainChange = async () => {
    if (chain.disable) {
      return tools.toastError('This network is not available');
    }

    // if (currentChain.enum == chain.enum) {
    //   return;
    // }

    if (chain.enum === ChainType.GLITTR_DEVNET) {
      setShowApiKey(true);
      return;
    }

    await changeChainType(chain.enum);
    props.onClose();
    reloadAccounts();
    tools.toastSuccess(`Changed to ${chain.label}`);
  };

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      return tools.toastError('API Key is required');
    }
    setGlittrApiKey(apiKey);
    await changeChainType(chain.enum);
    props.onClose();
    reloadAccounts();
    tools.toastSuccess(`Changed to ${chain.label}`);
  };

  return (
    <Column gap="zero">
      <Card
        style={Object.assign(
          {},
          {
            borderRadius: 10,
            borderColor: colors.gold,
            borderWidth: selected ? 1 : 0
          },
          props.inGroup
            ? { backgroundColor: 'opacity', marginTop: 6 }
            : {
              backgroundColor: chain.disable ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)',
              marginTop: 12
            }
        )}
        onClick={handleChainChange}>
        <Row fullX justifyBetween itemsCenter>
          <Row itemsCenter>
            <Image src={chain.icon} size={30} style={{ opacity: chain.disable ? 0.7 : 1 }} />
            <Column>
              <Text text={chain.label} color={chain.disable ? 'textDim' : 'text'} />
              {showApiKey ?
                <>
                  <Column mt="md" style={{ minWidth: '250px', width: '250px' }}>
                    <Input
                      placeholder="Enter Glittr API Key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      containerStyle={{ padding: '8px', minHeight: '20px' }}
                    />
                    <Row fullX>
                      <Button text="Save API Key" preset="primary" onClick={handleApiKeySubmit}
                        full style={{ height: '30px', minHeight: '10px' }}
                      />
                    </Row>
                  </Column>
                </> : chain.enum === ChainType.GLITTR_DEVNET && apiKey &&
                <Text text={`API Key : ${apiKey.length > 12 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : apiKey}`} color={'text'} style={{ fontSize: '10px' }} />
              }
            </Column>
          </Row>
        </Row>
      </Card>


    </Column>
  );
}

function ChainGroup(props: { group: TypeChainGroup; onClose: () => void }) {
  const group = props.group;
  const currentChain = useChain();

  const [folded, setFolded] = useState(true);

  useEffect(() => {
    if (group.type === 'list') {
      let defaultFolded = true;
      if (group.items && group.items.find((v) => v.enum == currentChain.enum)) {
        defaultFolded = false;
      }
      setFolded(defaultFolded);
    }
  }, [currentChain]);

  if (group.type === 'single') {
    return <ChainItem chainType={group.chain!.enum} onClose={props.onClose} />;
  } else {
    return (
      <Column>
        <Card
          style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: 10,
            borderColor: colors.gold,
            borderWidth: 0
          }}
          mt="lg"
          onClick={() => {
            setFolded(!folded);
          }}>
          <Column fullX gap="zero">
            <Row fullX justifyBetween itemsCenter>
              <Row itemsCenter>
                <Image src={group.icon} size={30} />
                <Text text={group.label} color={'text'} />
              </Row>
              {folded ? <Icon icon="down" /> : <Icon icon="up" />}
            </Row>
            {!folded ? (
              <Row
                style={{ borderTopWidth: 1, borderColor: '#FFFFFF1F', alignSelf: 'stretch', width: '100%' }}
                my="md"
              />
            ) : null}

            {!folded ? (
              <Column gap="zero">
                {group.items &&
                  group.items.map((v) => <ChainItem key={v.enum} inGroup chainType={v.enum} onClose={props.onClose} />)}
              </Column>
            ) : null}
          </Column>
        </Card>
      </Column>
    );
  }
}

export const SwitchChainModal = ({ onClose }: { onClose: () => void }) => {
  return (
    <BottomModal onClose={onClose}>
      <Column justifyCenter itemsCenter>
        <Row justifyBetween itemsCenter style={{ height: 20 }} fullX>
          <Text text="Select Network" textCenter size="md" />
          <Row
            onClick={() => {
              onClose();
            }}>
            <CloseOutlined />
          </Row>
        </Row>

        <Row fullX style={{ borderTopWidth: 1, borderColor: colors.border }} mt="md" />

        <Column gap="zero" mt="sm" mb="lg" fullX>
          {CHAIN_GROUPS.map((v, index) => (
            <ChainGroup key={'chain_group_' + index} group={v} onClose={onClose} />
          ))}
        </Column>
      </Column>
    </BottomModal>
  );
};
