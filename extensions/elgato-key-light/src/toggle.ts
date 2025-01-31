import { KeyLight } from "./elgato";
import { run } from "./utils";

const command = async () => {
  const keyLight = await KeyLight.discover();
  console.log(keyLight);
  const isOn = await keyLight.toggle();
  return isOn ? "Key Light turned on" : "Key Light turned off";
};

export default run(command);
