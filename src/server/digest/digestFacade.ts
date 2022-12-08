// import axios from "axios"
// import { IDigestRequest, IDigestResponse } from "./types"

// export async function CreateDigest(digestRequest: IDigestRequest): Promise<IDigestResponse> {
//     try {
//         const digest = await axios.post("http://dss:8080/services/rest/signature/one-document/getDataToSign", digestRequest)
//         return { digest: digest.data.bytes }
//     } catch (error) {
//         throw Error((error as any).response.data)
//     }
// }
