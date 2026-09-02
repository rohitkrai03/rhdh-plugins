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

import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Link,
  Text,
} from '@backstage/ui';

import { useTranslation } from '../../../hooks/useTranslation';
import { getAssetLocations } from '../../../utils/entityHelpers';
import styles from './AssetLocationCard.module.css';

export const AssetLocationCard = () => {
  const { entity } = useEntity();
  const { t } = useTranslation();
  const locations = getAssetLocations(entity);

  if (locations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <Text variant="title-small">
          {t('catalog.card.assetLocationTitle')}
        </Text>
      </CardHeader>
      <CardBody>
        <Flex direction="column" gap="3">
          {locations.map(location => (
            <Flex
              key={`${location.type}:${location.value}`}
              direction="column"
              gap="1"
            >
              <Badge size="small">
                {location.type === 'git'
                  ? t('catalog.card.assetLocationGit')
                  : t('catalog.card.assetLocationOci')}
              </Badge>
              {location.type === 'git' ? (
                <Link
                  href={location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.location}
                >
                  {location.value}
                </Link>
              ) : (
                <code className={styles.location}>{location.value}</code>
              )}
            </Flex>
          ))}
        </Flex>
      </CardBody>
    </Card>
  );
};
