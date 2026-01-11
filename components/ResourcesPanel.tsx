import React, { useState } from 'react';
import { Resource } from '../types';
import { useTranslation } from '../utils/i18n';
import { useAppStore } from '../stores/useAppStore';

import ResourceTable from './ResourceTable';
import { ResourceDetails } from './ResourceDetails';

const ResourcesPanel: React.FC = () => {
    const {
        data,
        setSelIds,
        userSettings
    } = useAppStore();

    const { t } = useTranslation(userSettings.language);

    return (
        <div className="flex-grow flex flex-col h-full bg-white select-none">
            {/* Content: Split View */}
            <div className="flex-grow flex flex-col overflow-hidden relative">
                {/* Top: Resource Table */}
                <div className="flex-grow overflow-hidden flex flex-col">
                    <ResourceTable />
                </div>

                {/* Bottom: Details Panel */}
                <ResourceDetails />
            </div>
        </div>
    );
};

export default ResourcesPanel;
