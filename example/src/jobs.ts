export type Jobs = {
  "send-email": {
    to: string;
    subject: string;
  };

  "process-image": {
    path: string;
    output: string;
  };

  "process-video": {
    input: string;
    output: string;
  };
};
