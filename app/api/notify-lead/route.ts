import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// 格式化菜品数量，只显示数量大于0的
const formatItems = (items: any) => {
  return Object.entries(items)
    .filter(([_, item]: [string, any]) => item.quantity > 0)
    .map(([name, item]: [string, any]) => {
      const formattedName = name.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      return `${formattedName}: ${item.quantity} ($${item.total.toFixed(2)})`;
    })
    .join('<br>');
};

// 生成询价邮件模板
const generateQuoteEmail = (data: any) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
    <h2 style="color: #E4572E; border-bottom: 2px solid #E4572E; padding-bottom: 10px;">Real Hibachi 新客户询价</h2>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333;">客户信息</h3>
      <p><strong>姓名:</strong> ${data.customer.name}</p>
      <p><strong>电话:</strong> ${data.customer.phone}</p>
      <p><strong>邮箱:</strong> ${data.customer.email}</p>
      <p><strong>地址:</strong> ${data.customer.address.street}</p>
      <p><strong>城市:</strong> ${data.customer.address.city}</p>
      <p><strong>州:</strong> ${data.customer.address.state}</p>
      <p><strong>邮编:</strong> ${data.customer.address.zipcode}</p>
    </div>

    <div style="margin-bottom: 20px;">
      <h3 style="color: #333;">人数信息</h3>
      <p><strong>成人:</strong> ${data.order.guests.adults} 人 ($${data.order.pricing.base_costs.adults.total.toFixed(2)})</p>
      <p><strong>儿童:</strong> ${data.order.guests.kids} 人 ($${data.order.pricing.base_costs.kids.total.toFixed(2)})</p>
      <p><strong>总人数:</strong> ${data.order.guests.total} 人</p>
    </div>

    <div style="margin-bottom: 20px;">
      <h3 style="color: #333;">菜品选择</h3>
      <div style="margin-bottom: 10px;">
        <h4 style="color: #666;">开胃菜</h4>
        ${formatItems(data.order.items.appetizers)}
      </div>
      <div style="margin-bottom: 10px;">
        <h4 style="color: #666;">主菜升级</h4>
        ${formatItems(data.order.items.premium_mains)}
      </div>
      <div style="margin-bottom: 10px;">
        <h4 style="color: #666;">配菜</h4>
        ${formatItems(data.order.items.sides)}
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <h3 style="color: #333;">价格明细</h3>
      <p><strong>基础餐费:</strong> $${data.order.pricing.subtotal.toFixed(2)}</p>
      <p><strong>交通费:</strong> $${data.order.pricing.fees.travel_fee.toFixed(2)}</p>
      <p style="font-size: 1.2em; font-weight: bold; color: #E4572E;">
        <strong>总计:</strong> $${data.order.pricing.total.toFixed(2)}
      </p>
    </div>

    ${data.order.scheduling.selected_date ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #333;">时间选择</h3>
        <p><strong>日期:</strong> ${new Date(data.order.scheduling.selected_date).toLocaleDateString()}</p>
        <p><strong>时间:</strong> ${data.order.scheduling.selected_time}</p>
        ${data.order.scheduling.discount > 0 ? `
          <p style="color: #28a745;">
            <strong>特别优惠:</strong> -$${data.order.scheduling.discount.toFixed(2)}
          </p>
        ` : ''}
      </div>
    ` : ''}

    ${data.order.notes ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #333;">备注</h3>
        <p>${data.order.notes}</p>
      </div>
    ` : ''}

    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.9em; color: #666;">
      <p><strong>询价时间:</strong> ${new Date(data.metadata.timestamp).toLocaleString()}</p>
      <p><strong>来源:</strong> ${data.metadata.source} (${data.metadata.platform})</p>
    </div>
  </div>
`;

// 生成订单确认邮件模板
const generateOrderConfirmationEmail = (data: any) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
    <h2 style="color: #E4572E; border-bottom: 2px solid #E4572E; padding-bottom: 10px;">Real Hibachi 新订单确认</h2>
    
    <div style="margin-bottom: 20px; background-color: #f8f9fa; padding: 15px; border-radius: 5px;">
      <p style="color: #28a745; font-weight: bold; margin: 0;">
        订单号: ${data.order.order_id}
      </p>
      <p style="color: #666; margin: 5px 0 0 0;">
        状态: 待支付定金
      </p>
    </div>

    <div style="margin-bottom: 20px;">
      <h3 style="color: #333;">客户信息</h3>
      <p><strong>姓名:</strong> ${data.customer.name}</p>
      <p><strong>电话:</strong> ${data.customer.phone}</p>
      <p><strong>邮箱:</strong> ${data.customer.email}</p>
      <p><strong>地址:</strong> ${data.customer.address.street}</p>
      <p><strong>城市:</strong> ${data.customer.address.city}</p>
      <p><strong>州:</strong> ${data.customer.address.state}</p>
      <p><strong>邮编:</strong> ${data.customer.address.zipcode}</p>
    </div>

    <div style="margin-bottom: 20px;">
      <h3 style="color: #333;">人数信息</h3>
      <p><strong>成人:</strong> ${data.order.guests.adults} 人 ($${data.order.pricing.base_costs.adults.total.toFixed(2)})</p>
      <p><strong>儿童:</strong> ${data.order.guests.kids} 人 ($${data.order.pricing.base_costs.kids.total.toFixed(2)})</p>
      <p><strong>总人数:</strong> ${data.order.guests.total} 人</p>
    </div>

    <div style="margin-bottom: 20px;">
      <h3 style="color: #333;">菜品选择</h3>
      <div style="margin-bottom: 10px;">
        <h4 style="color: #666;">开胃菜</h4>
        ${formatItems(data.order.items.appetizers)}
      </div>
      <div style="margin-bottom: 10px;">
        <h4 style="color: #666;">主菜升级</h4>
        ${formatItems(data.order.items.premium_mains)}
      </div>
      <div style="margin-bottom: 10px;">
        <h4 style="color: #666;">配菜</h4>
        ${formatItems(data.order.items.sides)}
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <h3 style="color: #333;">价格明细</h3>
      <p><strong>基础餐费:</strong> $${data.order.pricing.subtotal.toFixed(2)}</p>
      <p><strong>交通费:</strong> $${data.order.pricing.fees.travel_fee.toFixed(2)}</p>
      <p style="font-size: 1.2em; font-weight: bold; color: #E4572E;">
        <strong>总计:</strong> $${data.order.pricing.total.toFixed(2)}
      </p>
    </div>

    <div style="margin-bottom: 20px;">
      <h3 style="color: #333;">时间选择</h3>
      <p><strong>日期:</strong> ${new Date(data.order.scheduling.selected_date).toLocaleDateString()}</p>
      <p><strong>时间:</strong> ${data.order.scheduling.selected_time}</p>
      ${data.order.scheduling.discount > 0 ? `
        <p style="color: #28a745;">
          <strong>特别优惠:</strong> -$${data.order.scheduling.discount.toFixed(2)}
        </p>
      ` : ''}
    </div>

    ${data.order.notes ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #333;">备注</h3>
        <p>${data.order.notes}</p>
      </div>
    ` : ''}

    <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
      <h3 style="color: #333; margin-top: 0;">下一步</h3>
      <p style="margin-bottom: 10px;">请尽快完成定金支付以确认订单。支付完成后，我们将发送确认邮件。</p>
      <p style="margin: 0; color: #666;">如有任何问题，请随时联系我们。</p>
    </div>

    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.9em; color: #666;">
      <p><strong>下单时间:</strong> ${new Date(data.metadata.timestamp).toLocaleString()}</p>
      <p><strong>来源:</strong> ${data.metadata.source} (${data.metadata.platform})</p>
    </div>
  </div>
`;

export async function POST(request: Request) {
  console.log("=== Notify Lead API Called ===");
  console.log("Timestamp:", new Date().toISOString());
  
  // 记录环境变量状态
  console.log("Environment Check:");
  console.log("- RESEND_API_KEY exists:", !!process.env.RESEND_API_KEY);
  console.log("- EMAIL_FROM:", process.env.EMAIL_FROM || "not set");
  console.log("- NODE_ENV:", process.env.NODE_ENV);

  try {
    const data = await request.json();
    const tag = request.headers.get('X-RealHibachi-Tag') || 'quote_request';
    
    console.log("Request Details:");
    console.log("- Tag:", tag);
    console.log("- Customer Name:", data.customer?.name);
    console.log("- Customer Email:", data.customer?.email);
    console.log("- Total Guests:", data.order?.guests?.total);

    // 根据标签选择邮件模板
    const html = tag === 'order_confirmation' 
      ? generateOrderConfirmationEmail(data)
      : generateQuoteEmail(data);

    // 根据标签设置邮件主题
    const subject = tag === 'order_confirmation'
      ? `Real Hibachi 新订单确认 - ${data.customer.name} (订单号: ${data.order.order_id})`
      : `Real Hibachi 新客户询价 - ${data.customer.name} (${data.order.guests.total}人)`;

    console.log("Preparing to send email:");
    console.log("- From:", "notify@realhibachi.com");
    console.log("- To:", "darrien.wang@gmail.com");
    console.log("- Subject:", subject);

    try {
      console.log("Attempting to send email with Resend...");
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: "notify@realhibachi.com",
        to: "darrien.wang@gmail.com",
        subject,
        html,
      });

      if (emailError) {
        console.error("Resend API Error:", {
          error: emailError,
          message: emailError.message
        });
        throw emailError;
      }

      console.log("Email sent successfully:", {
        id: emailData?.id
      });

      return NextResponse.json({ 
        success: true,
        emailId: emailData?.id 
      });
    } catch (sendError: any) {
      console.error("Detailed Send Error:", {
        name: sendError.name,
        message: sendError.message,
        response: sendError.response?.data
      });
      
      return NextResponse.json({ 
        success: false, 
        error: "Failed to send email",
        details: sendError.message
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Request Processing Error:", {
      name: error.name,
      message: error.message
    });
    
    return NextResponse.json({ 
      success: false, 
      error: "Failed to process request",
      details: error.message
    }, { status: 500 });
  }
}
