import { useMutation } from "@tanstack/react-query";
import sendFeedback from "@/fetchers/feedback/send-feedback";

function useSendFeedback() {
  return useMutation({
    mutationFn: sendFeedback,
  });
}

export default useSendFeedback;
