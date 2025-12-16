import {
  FormControl,
  FormLabel,
  Select,
  SelectContent,
  SelectIcon,
  SelectListbox,
  SelectOption,
  SelectOptionIndicator,
  SelectOptionText,
  SelectPlaceholder,
  SelectTrigger,
  SelectValue,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
} from "@hope-ui/solid";
import { createEffect, createSignal, For, Show } from "solid-js";
import { getKeyOrDefault, setKey } from "../utils";
import { Config } from "./config-def";
import {
  DXMTMirrorClient,
  DXMTVersionOption,
  transformBuildsToOptions,
} from "../dxmt-mirror";

declare module "./config-def" {
  interface Config {
    dxmtVersion: string; // "default" | tag | run_id
  }
}

export async function createDXMTVersionConfig({
  config,
}: {
  config: Partial<Config>;
}) {
  // Load saved version
  config.dxmtVersion = await getKeyOrDefault("dxmt_selected_version", "default");

  // Create signals
  const [value, setValue] = createSignal(config.dxmtVersion);
  const [releases, setReleases] = createSignal<DXMTVersionOption[]>([]);
  const [ciBuilds, setCiBuilds] = createSignal<DXMTVersionOption[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Determine which tab and value to show
  const isDefaultOrRelease = () => {
    const v = value();
    if (v === "default") return true;
    return releases().some(r => r.id === v);
  };

  // Separate values for each tab
  const [releaseValue, setReleaseValue] = createSignal(
    isDefaultOrRelease() ? value() : "default"
  );
  const [ciValue, setCiValue] = createSignal(
    !isDefaultOrRelease() ? value() : ""
  );

  // Fetch builds from API
  const client = new DXMTMirrorClient();

  async function fetchBuilds() {
    setLoading(true);
    setError(null);
    try {
      const response = await client.listBuilds(1, 100);
      const { releases: r, ciBuilds: ci } = transformBuildsToOptions(
        response.builds
      );
      setReleases(r);
      setCiBuilds(ci);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // Fetch on mount
  fetchBuilds();

  // Handle release selection
  function onReleaseChange(newValue: string) {
    setReleaseValue(newValue);
    setCiValue(""); // Clear CI selection
    setValue(newValue);
  }

  // Handle CI selection
  function onCiChange(newValue: string) {
    setCiValue(newValue);
    setReleaseValue(""); // Clear release selection
    setValue(newValue);
  }

  // Auto-save on change
  createEffect(() => {
    const newValue = value();
    if (newValue !== config.dxmtVersion) {
      config.dxmtVersion = newValue;
      setKey("dxmt_selected_version", newValue);
    }
  });

  return [
    function UI() {
      return (
        <FormControl id="dxmtVersion">
          <FormLabel>DXMT Version</FormLabel>
          <Show when={!loading()} fallback={<Text>Loading versions...</Text>}>
            <Tabs orientation="horizontal">
              <TabList>
                <Tab>Releases</Tab>
                <Tab>CI Builds</Tab>
              </TabList>

              <TabPanel pt="$3">
                <Select value={releaseValue()} onChange={onReleaseChange}>
                  <SelectTrigger>
                    <SelectPlaceholder>Choose a release</SelectPlaceholder>
                    <SelectValue />
                    <SelectIcon />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectListbox>
                      <SelectOption value="default">
                        <SelectOptionText>
                          Default (Stable v0.71.0)
                        </SelectOptionText>
                        <SelectOptionIndicator />
                      </SelectOption>
                      <For each={releases()}>
                        {option => (
                          <SelectOption value={option.id}>
                            <SelectOptionText>{option.label}</SelectOptionText>
                            <SelectOptionIndicator />
                          </SelectOption>
                        )}
                      </For>
                    </SelectListbox>
                  </SelectContent>
                </Select>
              </TabPanel>

              <TabPanel pt="$3">
                <Select value={ciValue()} onChange={onCiChange}>
                  <SelectTrigger>
                    <SelectPlaceholder>Choose a CI build</SelectPlaceholder>
                    <SelectValue />
                    <SelectIcon />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectListbox>
                      <SelectOption value="">
                        <SelectOptionText>Use Default</SelectOptionText>
                        <SelectOptionIndicator />
                      </SelectOption>
                      <For each={ciBuilds()}>
                        {option => (
                          <SelectOption value={option.id}>
                            <SelectOptionText>{option.label}</SelectOptionText>
                            <SelectOptionIndicator />
                          </SelectOption>
                        )}
                      </For>
                    </SelectListbox>
                  </SelectContent>
                </Select>
              </TabPanel>
            </Tabs>
          </Show>
          <Show when={error()}>
            <Text size="xs" color="$danger9">
              Failed to load versions. Using default.
            </Text>
          </Show>
        </FormControl>
      );
    },
  ] as const;
}

