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
import { getKeyOrDefault, setKey, log } from "../utils";
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
  config.dxmtVersion = await getKeyOrDefault(
    "dxmt_selected_version",
    "default"
  );

  // Create signals
  const [value, setValue] = createSignal(config.dxmtVersion);
  const [releases, setReleases] = createSignal<DXMTVersionOption[]>([]);
  const [ciBuilds, setCiBuilds] = createSignal<DXMTVersionOption[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Separate values for each tab - initialize empty, will be set after fetch
  const [releaseValue, setReleaseValue] = createSignal("default");
  const [ciValue, setCiValue] = createSignal("");

  // Fetch builds from API
  const client = new DXMTMirrorClient();

  async function fetchBuilds() {
    setLoading(true);
    setError(null);
    try {
      await log("Starting DXMT builds fetch...");
      const response = await client.listBuilds(1, 100);
      await log(`DXMT builds fetched: ${response.builds.length} builds`);
      const { releases: r, ciBuilds: ci } = transformBuildsToOptions(
        response.builds
      );
      await log(
        `Transformed to ${r.length} releases and ${ci.length} CI builds`
      );
      setReleases(r);
      setCiBuilds(ci);

      // After builds are loaded, set the correct initial values
      const savedVersion = value();
      log(`Saved DXMT version: ${savedVersion}`);
      if (savedVersion === "default") {
        setReleaseValue("default");
        setCiValue("");
      } else if (r.some(release => release.id === savedVersion)) {
        // It's a release
        setReleaseValue(savedVersion);
        setCiValue("");
      } else if (ci.some(build => build.id === savedVersion)) {
        // It's a CI build
        setReleaseValue("");
        setCiValue(savedVersion);
      } else {
        // Unknown version, default to "default"
        await log(
          `Unknown saved DXMT version: ${savedVersion}, defaulting to default`
        );
        setReleaseValue("default");
        setCiValue("");
        setValue("default");
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      await log(`Failed to fetch DXMT builds: ${errorMsg}`);
      setError(errorMsg);
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
    if (newValue === "") {
      // User selected "Use Default" in CI tab
      setCiValue("");
      setReleaseValue("default");
      setValue("default");
    } else {
      setCiValue(newValue);
      setReleaseValue(""); // Clear release selection
      setValue(newValue);
    }
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
              Failed to load versions: {error()}
            </Text>
          </Show>
        </FormControl>
      );
    },
  ] as const;
}
