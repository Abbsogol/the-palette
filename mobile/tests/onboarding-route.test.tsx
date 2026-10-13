import { fireEvent,render,screen,waitFor } from "@testing-library/react-native";
import Onboarding from "../src/app/onboarding";
import { api } from "../src/lib/api";
import { router } from "expo-router";
import { accountScope } from "../src/lib/account-scope";
import { loadProgress,clearProgress,saveProgress } from "../src/features/onboarding/progress";
const mockInvalidate=jest.fn().mockResolvedValue(undefined);
const mockProfile={id:"account-a",display_name:"Sarah",username:"sarah.nails",location:"Dubai",bio:"",booking_area:"",account_type:"user",onboarding_complete:false};
jest.mock("react-native-safe-area-context",()=>require("react-native-safe-area-context/jest/mock").default);
jest.mock("../src/components/ui",()=>({RequireAuth:({children}:any)=>children,QueryState:({children,loading,error,retry}:any)=>{
 const {Text,Pressable}=require("react-native");
 return error?<Pressable accessibilityRole="button" onPress={retry}><Text>Retry setup</Text></Pressable>:loading?<Text>Loading</Text>:children;
}}));
jest.mock("../src/lib/auth",()=>({useProfile:()=>({data:mockProfile,isPending:false,error:null,refetch:jest.fn()}),queryClient:{invalidateQueries:()=>mockInvalidate()}}));
jest.mock("../src/lib/api",()=>({api:jest.fn()}));
jest.mock("../src/lib/upload",()=>({chooseAndUpload:jest.fn()}));
jest.mock("../src/lib/designs",()=>({resolvePrivateImage:jest.fn().mockResolvedValue(null)}));
jest.mock("../src/lib/secure-storage",()=>({secureStorage:{getItem:jest.fn().mockResolvedValue("/saved"),removeItem:jest.fn().mockResolvedValue(undefined)}}));
jest.mock("../src/features/onboarding/progress",()=>({loadProgress:jest.fn(),saveProgress:jest.fn().mockResolvedValue(undefined),clearProgress:jest.fn().mockResolvedValue(undefined)}));
const restored={step:1 as const,draft:{display_name:"My saved name",username:"my.saved.id",location:"Dubai",bio:"",booking_area:"",role:"Customer" as const}};
beforeEach(()=>{
 accountScope.change("account-a",true);jest.mocked(api).mockReset().mockResolvedValue({ok:true});
 jest.mocked(loadProgress).mockReset().mockResolvedValue(restored);
 jest.mocked(clearProgress).mockClear();jest.mocked(router.replace).mockClear();jest.mocked(saveProgress).mockClear();
});
async function finish(){
 await fireEvent.press(screen.getByRole("checkbox",{name:"I am 18 or older"}));
 await fireEvent.press(screen.getByRole("checkbox",{name:"I have read the Privacy Policy"}));
 await fireEvent.press(screen.getByRole("button",{name:"Finish my profile"}));
}
test("partial API failure preserves restored fields and waits for all server writes on retry",async()=>{
 jest.mocked(api).mockImplementation(async(path)=>{if(path==="/update-profile")throw new Error("ID is already taken");return {ok:true} as any;});
 await render(<Onboarding/>);
 await waitFor(()=>expect(screen.getByLabelText("Username").props.value).toBe("my.saved.id"));
 await finish();expect(screen.getByText("ID is already taken")).toBeTruthy();
 expect(jest.mocked(api).mock.calls.some(c=>c[0]==="/complete-onboarding")).toBe(false);
 expect(router.replace).not.toHaveBeenCalled();expect(clearProgress).not.toHaveBeenCalled();
 jest.mocked(api).mockResolvedValue({ok:true});
 await fireEvent.changeText(screen.getByLabelText("Username"),"my.other.id");
 await fireEvent.press(screen.getByRole("button",{name:"Finish my profile"}));
 await waitFor(()=>expect(screen.getByText("PROFILE COMPLETE")).toBeTruthy());
 expect(api).toHaveBeenCalledWith("/complete-onboarding",expect.objectContaining({display_name:"My saved name",age_confirmed:true,privacy_accepted:true}));
 await fireEvent.press(screen.getByRole("button",{name:"Explore LaQue"}));
 expect(clearProgress).toHaveBeenCalled();expect(router.replace).toHaveBeenCalledWith("/saved");
});
test("a failed draft save is visible and can be retried without clearing the form",async()=>{
 jest.mocked(saveProgress).mockRejectedValueOnce(new Error("Storage unavailable"));
 await render(<Onboarding/>);
 await waitFor(()=>expect(screen.getByRole("button",{name:"Retry saving progress"})).toBeTruthy());
 await fireEvent.press(screen.getByRole("button",{name:"Retry saving progress"}));
 await waitFor(()=>expect(screen.getByText("Progress saved on this device.")).toBeTruthy());
 expect(screen.getByLabelText("Display name").props.value).toBe("My saved name");
});
