import { createSignal, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import OperationModal from "../components/OperationModal";
import ScoopConfiguration from "../components/page/settings/ScoopConfiguration";
import StartupSettings from "../components/page/settings/StartupSettings";
import VirusTotalSettings from "../components/page/settings/VirusTotalSettings";
import HeldPackagesManagement from "../components/page/settings/HeldPackagesManagement";
import AboutSection, { AboutSectionRef } from "../components/page/settings/AboutSection";
import DebugSettings from "../components/page/settings/DebugSettings";
import WindowBehaviorSettings from "../components/page/settings/WindowBehaviorSettings";
import heldStore from "../stores/held";

interface SettingsPageProps {
    activeSection: string;
    onSectionChange: (section: string) => void;
    isScoopInstalled?: boolean;
}

function SettingsPage(_props: SettingsPageProps) {
    const { refetch: refetchHeldPackages } = heldStore;
    const [operationTitle, setOperationTitle] = createSignal<string | null>(null);
    let aboutSectionRef: AboutSectionRef | undefined;

    onMount(() => {
        if (aboutSectionRef) {
            aboutSectionRef.checkForUpdates(false);
        }
    });

    const handleUnhold = (packageName: string) => {
        setOperationTitle(`Removing hold from ${packageName}...`);
        invoke("unhold_package", { packageName }).finally(() => {
            refetchHeldPackages();
        });
    };

    const handleCloseOperationModal = () => {
        setOperationTitle(null);
    };

    const setAboutSectionRef = (ref: AboutSectionRef) => {
        aboutSectionRef = ref;
    };

    return (
        <>
            <div class="p-4 sm:p-6 md:p-8">
                <h1 class="text-3xl font-bold mb-6">Settings</h1>

                <div class="space-y-8">
                    <div class="space-y-8" classList={{ 'pb-8': true }}>
                        <ScoopConfiguration />
                        <StartupSettings />
                    </div>
                    
                    <div class="divider">Security</div>
                    
                    <div class="space-y-8" classList={{ 'pb-8': true }}>
                        <VirusTotalSettings />
                    </div>
                    
                    <div class="divider">Package Management</div>
                    
                    <div class="space-y-8" classList={{ 'pb-8': true }}>
                        <HeldPackagesManagement
                            onUnhold={handleUnhold}
                            operationInProgress={!!operationTitle()}
                        />
                    </div>
                    
                    <div class="divider">Application</div>
                    
                    <div class="space-y-8" classList={{ 'pb-8': true }}>
                        <WindowBehaviorSettings />
                        <DebugSettings />
                    </div>
                    
                    <div class="divider">About</div>
                    
                    <div class="pb-8">
                        <AboutSection ref={setAboutSectionRef} />
                    </div>
                </div>
            </div>
            <OperationModal
                title={operationTitle()}
                onClose={handleCloseOperationModal}
            />
        </>
    );
}

export default SettingsPage;