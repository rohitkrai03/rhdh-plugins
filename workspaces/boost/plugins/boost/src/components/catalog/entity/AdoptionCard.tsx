/*
 * Copyright Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  VisuallyHidden,
} from '@backstage/ui';
import {
  RiCheckLine,
  RiDownload2Line,
  RiExternalLinkLine,
  RiFileCopyLine,
} from '@remixicon/react';

import { useTranslation } from '../../../hooks/useTranslation';
import {
  type AdoptionAction,
  getAdoptionAction,
} from '../../../utils/entityHelpers';
import styles from './AdoptionCard.module.css';

type CopyStatus = 'idle' | 'success' | 'error';

export const AdoptionCard = () => {
  const { entity } = useEntity();
  const { t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [lastCopyValue, setLastCopyValue] = useState<string>();
  const [selectedRuntime, setSelectedRuntime] = useState<'docker' | 'podman'>(
    'docker',
  );
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();

  const action = useMemo(() => getAdoptionAction(entity), [entity]);

  useEffect(() => {
    setSelectedRuntime('docker');
    setCopyStatus('idle');
  }, [action]);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const copyValue = useCallback(async (value: string) => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setLastCopyValue(value);
    setCopyStatus('idle');
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus('success');
      resetTimer.current = setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('error');
    }
  }, []);

  if (!action) return null;

  const renderCopyableValue = (value: string, copyUrl = false) => (
    <>
      <Flex align="center" gap="2" className={styles.copyRow}>
        <code className={styles.command}>{value}</code>
        <Button
          variant="tertiary"
          size="small"
          onPress={() => void copyValue(value)}
          aria-label={
            copyUrl
              ? t('catalog.card.copyUrlAriaLabel')
              : t('catalog.card.copyAriaLabel')
          }
          iconStart={
            copyStatus === 'success' && lastCopyValue === value ? (
              <RiCheckLine size={16} />
            ) : (
              <RiFileCopyLine size={16} />
            )
          }
        >
          {copyStatus === 'success' && lastCopyValue === value
            ? t('catalog.card.copied')
            : t('catalog.card.copyCommand')}
        </Button>
      </Flex>
      {copyStatus === 'error' && lastCopyValue === value && (
        <Alert
          mt="3"
          status="danger"
          icon
          role="alert"
          title={t('catalog.card.copyFailedTitle')}
          description={t('catalog.card.copyFailedDescription')}
          customActions={
            <Button
              size="small"
              variant="tertiary"
              onPress={() => void copyValue(value)}
            >
              {t('catalog.card.retryCopy')}
            </Button>
          }
        />
      )}
      <VisuallyHidden>
        <span aria-live="polite" aria-atomic="true">
          {copyStatus === 'success' && lastCopyValue === value
            ? t('catalog.card.copied')
            : ''}
        </span>
      </VisuallyHidden>
    </>
  );

  const renderAction = (resolvedAction: AdoptionAction) => {
    switch (resolvedAction.type) {
      case 'copy-command': {
        if (resolvedAction.commands.length === 1) {
          return renderCopyableValue(resolvedAction.commands[0].value);
        }
        return (
          <Tabs
            selectedKey={selectedRuntime}
            onSelectionChange={key => {
              if (key === 'docker' || key === 'podman') {
                setSelectedRuntime(key);
                setCopyStatus('idle');
              }
            }}
          >
            <TabList aria-label={t('catalog.card.adoptionTitle')}>
              <Tab id="docker">{t('catalog.card.docker')}</Tab>
              <Tab id="podman">{t('catalog.card.podman')}</Tab>
            </TabList>
            {resolvedAction.commands.map(command => (
              <TabPanel key={command.runtime} id={command.runtime}>
                {renderCopyableValue(command.value)}
              </TabPanel>
            ))}
          </Tabs>
        );
      }
      case 'copy-url':
        return renderCopyableValue(resolvedAction.value, true);
      case 'verified-download':
        return (
          <ButtonLink
            href={resolvedAction.href}
            target="_blank"
            rel="noopener noreferrer"
            iconStart={<RiDownload2Line size={16} />}
          >
            {t('catalog.card.adoptionDownloadZip')}
          </ButtonLink>
        );
      case 'view-source':
        return (
          <ButtonLink
            href={resolvedAction.href}
            target="_blank"
            rel="noopener noreferrer"
            iconStart={<RiExternalLinkLine size={16} />}
          >
            {t('catalog.card.adoptionViewSource')}
          </ButtonLink>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <Text variant="title-small">{t('catalog.card.adoptionTitle')}</Text>
      </CardHeader>
      <CardBody>{renderAction(action)}</CardBody>
    </Card>
  );
};
