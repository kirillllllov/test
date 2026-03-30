export interface messageImage{
    user_id:	string
    button:	string
    place:{
        chat_id: string,
    }
  attachments_base64: [string],
  date_time:	Date
}