export async function pinToIPFS(file: File, jwt: string): Promise<string> {
  const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Pinata error: ${res.status}`);
  const json = await res.json();
  return json.IpfsHash as string;
}


