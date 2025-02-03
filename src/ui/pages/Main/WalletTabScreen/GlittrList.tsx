import { Column, Row } from '@/ui/components';
import { TabBar } from '@/ui/components/TabBar';
import { useExtensionIsInTab } from '@/ui/features/browser/tabs';
import { useAppDispatch } from '@/ui/state/hooks';
import { useGlittrAssetTabKey } from '@/ui/state/ui/hooks';
import { GlittrAssetTabKey, uiActions } from '@/ui/state/ui/reducer';
import { useMemo } from 'react';
import { GlittrFTList } from './GlittrFTList';
import { GlittrNFTList } from './GlittrNFTList';

export function GlittrList() {
  const isInTab = useExtensionIsInTab();
  const tabKey = useGlittrAssetTabKey();
  const dispatch = useAppDispatch();

  const tabItems = useMemo(() => {
    const items = [
      {
        key: GlittrAssetTabKey.FT,
        label: 'FT',
        children: <GlittrFTList />
      },
      {
        key: GlittrAssetTabKey.NFT,
        label: 'NFT',
        children: <GlittrNFTList />
      }
    ];

    return items;
  }, []);

  const containerStyle = {
    width: 'auto',
    height: isInTab ? 'calc(100vh - 240px)' : '500px',
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
  };

  return (
    <Column style={containerStyle}>
      <Row style={{ flexWrap: 'wrap', padding: '8px' }} gap="sm">
        <TabBar
          defaultActiveKey={tabKey}
          activeKey={tabKey}
          items={tabItems}
          preset="style2"
          onTabClick={(key) => {
            dispatch(uiActions.updateAssetTabScreen({ glittrAssetTabKey: key }));
          }}
        />
      </Row>

      {tabItems[tabKey] ? tabItems[tabKey].children : null}
    </Column>
  );
}
